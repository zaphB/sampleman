const express = require('express');
const fs = require('fs');
const fse = require('fs-extra');
const marked = require('marked');
const multer = require('multer');
const os = require('os');

const cfg = require('./config');

const upload = multer({dest: os.tmpdir()})
const router = express.Router();

const dbDir = expandUser(cfg.database.baseDir);
const uploadDir = expandUser(cfg.database.uploadDir);

const COOKIE_AGE_SECS = 72*60*60

function lpad(int, len, char="0") {
  res = String(int)
  for(i=1; i<len; i++) {
    if(int < Math.pow(10, i)) {
      res = char + res
    }
  }
  return res
}

function expandUser(s) {
  if(s.startsWith('~')) {
    return s.replace('~', os.homedir()+'/')
  }
  return s
}

function fmtDate(d) {
  if(d==undefined) {
    d = new Date(Date.now())
  }
  return lpad(d.getDate(), 2)+'.'+lpad(d.getMonth()+1, 2)+'.'+d.getFullYear()
}

function fmtTime(d) {
  if(d==undefined) {
    d = new Date(Date.now())
  }
  return lpad(d.getHours(), 2)+':'+lpad(d.getMinutes(), 2)
}

function getAllSamples() {
  samples = []
  fse.mkdirpSync(dbDir)
  fs.readdirSync(dbDir).forEach(dir => {
    s = getSampleDetail(dir)
    if(s) {
      samples.push(s)
    }
  })
  samples.sort(function (s1, s2) {
    if (s2.creation != s1.creation) {
      return s2.creation - s1.creation
    }
    return ('' + s2.name.toLowerCase()).localeCompare(s1.name.toLowerCase())
  })
  return samples
}

function getSampleDetail(name) {
  if(name == 'none') {
    return false
  }
  s = {}
  try {
    const text = fs.readFileSync(dbDir+'/'+name+'/labbook.md', 'utf8')
    let latest = -1
    let stepList = []
    const r = /^\* (\d{1,2})\.(\d{1,2})\.(\d{4}) (\d{1,2}):(\d{2})\s+-\s+(\d+)\s+-\s+(.*)$/gm
    while(m = r.exec(text)) {
      const timestamp = new Date(m[3], m[2]-1, m[1], m[4], m[5]).valueOf()
      const id = Number(m[6])
      const step = m[7]
      if(timestamp > latest) {
        latest = timestamp
      }
      stepList.push({'id':id, 'title':step, 'timestamp':timestamp, 'timestr':fmtDate(new Date(timestamp))})
    }
    s.name = name
    m = text.split('\n')[0].match(/[^-]-(.*)/)
    if(m) {
      s.aim = m[1].trim()
    }
    else {
      s.aim = "..."
    }
    if (stepList.length > 0) {
      s.creation = stepList[stepList.length-1].timestamp
    }
    else {
      s.creation = Date.now()
    }
    s.creationStr = fmtDate(new Date(s.creation))
    s.lastchange = fmtDate(new Date(latest))
    s.steps = stepList
    s.labbookRaw = text
    s.labbook = marked(text)
    s.isGoodSample = fs.existsSync(dbDir+'/'+name+'/good-sample')
    s.isBadSample = fs.existsSync(dbDir+'/'+name+'/bad-sample')
  }
  catch(err) {
    //console.log(err)
    return false
  }
  return s
}

function escapeRegExp(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

function getNextSampleName() {
  m = []
  samples = getAllSamples()
  try {
    i = 0
    r = RegExp(escapeRegExp(cfg.database.samplePrefix)+'(\\d+)')
    do {
      m = r.exec(samples[i++].name)
    } while(!m);
  }
  catch(err) {
    //console.log(err)
    return cfg.database.samplePrefix+"001"
  }
  return cfg.database.samplePrefix+lpad(Number(m[1])+1, 3)
}

function getAllTemplates() {
  let templates = []
  let dir = dbDir+'/templates'
  fse.mkdirpSync(dbDir+'/templates');
  fs.readdirSync(dbDir+'/templates').forEach(file => {
    if(file.endsWith(".txt")) {
      templates.push(file.split('.')[0])
    }
  })
  return templates
}

function getTemplate(name) {
  templates = []
  try {
    text = fs.readFileSync(dbDir+'/templates/'+name+'.txt', 'utf8').split('\n')
    if(text.length == 1) {
      text[1] = ""
    }
    let i = 1;
    for(;i<text.length;i++) {
      if(text[i].replace(/\s+/g, '') != '') {
        break
      }
    }
    return {name: text[0], description: text.slice(i).join("\n")}
  }
  catch(err) {
    return {name: "", description: ""}
  }
}

function fileOrDirExists(path, regex) {
  m = [null]
  fs.readdirSync(path).some(file => {
    m[0] = file.match(regex)
    if(m[0]) {
      return Boolean(m[0])
    }
  })
  return m[0]?m[0][0]:false
}

function find(startPath, suffixes) {
  if (!fs.existsSync(startPath)) {
    return []
  }
  const result = []
  const files = fs.readdirSync(startPath).sort().reverse()
  for(let i=0; i<files.length; i++) {
    const filename = startPath + '/' + files[i]
    if (fs.lstatSync(filename).isDirectory()){
      result.push(...find(filename, suffixes))
    }
    else {
      for(let j=0; j<suffixes.length; j++) {
        if(filename.toLowerCase().endsWith('.'+suffixes[j])) {
          result.push(filename)
          break
        }
      }
    }
  }
  return result
}

let warnings = []
let loggedIn = false
let lastHeartbeat = Date.now()+30000

if(cfg.app.autoQuit) {
  setInterval(function() {
    if (Date.now()-lastHeartbeat > 10000) {
      process.exit()
    }
  }, 3000)
}

router.post("/*", function(req, res, next) {
  loggedIn = false
  if (req.body.token) {
    res.cookie('token', req.body.token, { maxAge: COOKIE_AGE_SECS*1e3, httpOnly: true });
    res.redirect(req.url)
    next = function() {}
  }
  next()
})

router.get("/*", function(req, res, next) {
  loggedIn = false
  if (!cfg.http.accessToken || req.cookies.token == cfg.http.accessToken) {
    res.cookie('token', req.cookies.token, { maxAge: COOKIE_AGE_SECS*1e3, httpOnly: true })
    loggedIn = true
  }
  next()
})

router.get('/:detailSample/:step', function(req, res, next) {
  warnings = []

  switch(req.params.step) {
  case "create-sample":
    newName = getNextSampleName()
    fse.mkdirpSync(dbDir+'/'+newName);
    let aim = req.query.aim.trim()
    if(aim != '') {
      aim = ' - '+aim
    }
    fs.writeFileSync(dbDir+'/'+newName+'/labbook.md', newName+aim+'\n'+Array(aim.length+10).join("=")+'\n\n');
    res.redirect("/"+newName)
    next = function() {}
    break;

  case "add-step":
    args = req.params.step.split("?")[1]
    name = req.query.name.trim()
    description = req.query.description.trim()
    if(description.length > 0) {
      description = "\n" + description
      reg = /\s*\n+(\s*)/g
      while(m = reg.exec(description)) {
        description = description.substr(0,m.index)
            + "\n" + Array(Math.floor(m[1].length/2)+1).join("  ") + "  * "
            + description.substr(m.index+m[0].length)
      }
      description = description.substr(1)
    }
    description += '\n\n'

    if(name.length < 3) {
      warnings.push("Step name must have at least 3 characters")
      break;
    }
    if(req.query.description.match(/_/)) {
      warnings.push("Please fill in all placeholders in step description.")
      break;
    }
    sample = getSampleDetail(req.params.detailSample)

    s = sample.labbookRaw
    let nextId = 1
    if(sample.steps.length > 0) {
      nextId = sample.steps[0].id + 1
    }
    text = "* "+fmtDate()+' '+fmtTime()+' - '+lpad(nextId, cfg.database.stepIdLen)+' - '+name+'\n'+description+'\n'
    m = /.*\n={3,}\n\n/m.exec(s)
    if(!m) {
      warnings.push("Invalid labbook, cannot save.")
      break;
    }
    pos = m.index + m[0].length
    newLabbook = s.substr(0,pos) + text + s.substr(pos)
    fs.writeFileSync(dbDir+'/'+req.params.detailSample+'/labbook.md', newLabbook)
    res.redirect("/"+req.params.detailSample)
    next = function() {}

  case "load-template":
    t = getTemplate(req.query['temp-name'])
    if(t.name) {
      res.redirect("/"+req.params.detailSample
          +'?name='+encodeURIComponent(t.name)
          +'&description='+encodeURIComponent(t.description))
      next = function() {}
    }

  case "import-files":
    stepid = Number(req.query.stepid)
    break

  case "upload-form":
    res.render('form', {
      'detailSample': getSampleDetail(req.params.detailSample),
      'status': 'neutral'
    })
    next = function() {}
    break;

  case "img":
    imgNum = (Number(req.query.id) || Number(0)).toFixed(0)
    imgs = find(dbDir+'/'+req.params.detailSample, ['jpg', 'jpeg', 'png'])
    if(imgNum < imgs.length) {
      if(req.query.path != undefined) {
        res.status(200).send(imgs[imgNum].replace(dbDir+'/'+req.params.detailSample, '').slice(1))
      }
      else {
        res.sendFile(imgs[imgNum])
      }
    }
    else {
      res.sendStatus(404)
    }
    next = function() {}
    break
  }
  next();
});

router.get('/:detailSample*', function(req, res, next) {

  // make sure updload folder exists
  fse.mkdirpSync(uploadDir)

  // in case of heartbeat just exit without rendering anything
  if (req.params.detailSample == 'heartbeat') {
    lastHeartbeat = Date.now()
    res.render('heartbeat')
  }
  else {
    res.render('index', {
      'samples': getAllSamples(),
      'detailSample': getSampleDetail(req.params.detailSample),
      'nextName': getNextSampleName(),
      'formName': req.query.name,
      'formDescription': req.query.description,
      'templates': getAllTemplates(),
      'warnings': warnings,
      'loggedIn': loggedIn,
      'imgCount': find(dbDir+'/'+req.params.detailSample,
                       ['jpg', 'jpeg', 'png']).length
    });
  }
  warnings = []
});

router.get('/', function(req, res, next) {
  s = getAllSamples()
  if(s.length > 0) {
    res.redirect('/'+s[0].name)
  }
  else {
    res.redirect('/none')
  }
})

router.post('/:detailSample/',
            upload.fields([{ name: 'file', maxCount: 24 }]),
            function(req, res, next) {

  ups = req.files.file
  if(ups || req.body.useuploadfolder) {

    basePath = dbDir+"/"+req.params.detailSample
    stepid = req.body.stepid

    detail = getSampleDetail(req.params.detailSample)
    if(stepid <= 0 || stepid != Number(stepid).toFixed(0)) {
      stepid = detail.steps[0].id
    }

    dir = fileOrDirExists(basePath, RegExp("^"+lpad(stepid, cfg.databasegstepIdLen)+".*$"))
    if(!dir) {
      step = detail.steps.find(function(t) {return t.id == Number(stepid)})
      w = step.title.split(" ")
      shortTitle = ""
      maxLen = 0
      for(let i=0; i<w.length; i++) {
        if(w[i].length > maxLen) {
          maxLen = w[i].length
          shortTitle = w[i].toLowerCase()
        }
      }
      dir = lpad(stepid, cfg.database.stepIdLen) + "-" + shortTitle
    }
    try {
      fs.mkdirSync(basePath+"/"+dir)
    }
    catch (e) {}

    if(ups) {
      for(i=0; i<ups.length; i++) {
        name = ups[i].originalname
        try {
          fse.moveSync(ups[i].path, basePath+"/"+dir+"/"+name)
        }
        catch(e) {
          console.log(e)
          warnings.push("Failed to upload '"+name+"'")
        }
      }
    }
    else {
      let count = Number(req.body.filecount)
      if(!count) {
        count = 255
      }
      files = fs.readdirSync(uploadDir+"/").sort()
      for(i=0; i<files.length && i<count; i++) {
        fse.moveSync(uploadDir+"/"+files[i], basePath+"/"+dir+"/"+files[i])
      }
    }
  }
  res.render('form', {
    'detailSample': getSampleDetail(req.params.detailSample),
    'status': 'success'
  })
})

module.exports = router;
