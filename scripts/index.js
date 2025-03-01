import * as express from 'express'
import * as fs from 'fs'
import fse from 'fs-extra'
import * as marked from 'marked'
import path from 'path'
import multer from 'multer'
import * as os from 'os'

import {default as cfg, absolutePath} from './config.js'
cfg.absolutePath = absolutePath

const upload = multer({dest: os.tmpdir()})
const router = express.Router();

const dbDir = cfg.absolutePath(cfg.database.baseDir);
const uploadDir = cfg.absolutePath(cfg.database.uploadDir);

const COOKIE_AGE_SECS = 72*60*60
const LABBOOK_FILENAME = 'labbook.md'
const IMG_FORMATS = ['jpg', 'jpeg', 'png', 'gif']

function lpad(int, len, char="0") {
  let res = String(int)
  for(let i=1; i<len; i++) {
    if(int < Math.pow(10, i)) {
      res = char + res
    }
  }
  return res
}

function fmtDate(d) {
  if(!d) {
    d = new Date(Date.now())
  }
  else {
    d = new Date(d)
  }
  return lpad(d.getDate(), 2)+'.'+lpad(d.getMonth()+1, 2)+'.'+d.getFullYear()
}

function fmtTime(d) {
  if(!d) {
    d = new Date(Date.now())
  }
  else {
    d = new Date(d)
  }
  return lpad(d.getHours(), 2)+':'+lpad(d.getMinutes(), 2)
}

function getAllSamples() {
  var samples = []
  if(fs.existsSync(dbDir)) {
    fs.readdirSync(dbDir).forEach(dir => {
      var s = getSampleDetail(dir)
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
  }
  return samples
}

function sanitize(string) {
  if(!string) {
    return string
  }
  return string.replace(/[^a-z0-9-_.]+/gmi, '_')
}

function getSampleDetail(name) {
  name = sanitize(name)

  if(    !fs.existsSync(path.join(dbDir, name))
      || !fs.lstatSync(path.join(dbDir, name)).isDirectory()
      || name.startsWith('.')
      || name == 'none'
      || name == 'templates')
  {
    return false
  }

  const labbookPath = path.join(dbDir, name, LABBOOK_FILENAME)
  if(!fs.existsSync(labbookPath)) {
    fs.writeFileSync(labbookPath, name+'\n'+Array(name.length+1).join("=")+'\n\n')
  }

  let s = {}
  try {
    let text = fs.readFileSync(labbookPath, 'utf8')

    // check whether newlines needed for readability were removed (e.g. by nextcloud)
    const lines = text.split('\n')
    let _fixedText = ''
    let _didFixText = false
    let indent = 0
    let isEmptyLine = false
    let previousIndent = 0
    let m = undefined;
    for (let i=0; i<lines.length; i++) {
      const line = lines[i]
      m = /^(\s*)\S/.exec(line)
      //console.log(line, m)
      if(m) {
        indent = m[1].length
        isEmptyLine = false
      }
      else {
        indent = 0
        isEmptyLine = true
      }
      //console.log(previousIndent, '->', indent)
      if (!isEmptyLine && indent < previousIndent) {
        //_didFixText = true
        //_fixedText += '\n'
      }
      _fixedText += line+'\n'
      previousIndent = indent
    }
    if (_didFixText) {
      fs.writeFileSync(labbookPath, _fixedText)
      text = _fixedText
    }

    let latest = -1
    let stepList = []
    const r = /^\* (\d{1,2})\\?\.(\d{1,2})\\?\.(\d{4}) (\d{1,2}):(\d{2})\s+-\s+(\d+)\s+-\s+(.*)$/gm
    while(m = r.exec(text)) {
      const timestamp = new Date(m[3], m[2]-1, m[1], m[4], m[5]).valueOf()
      const id = Number(m[6])
      const step = m[7]
      if(timestamp > latest) {
        latest = timestamp
      }
      stepList.push({'id':id, 'title':step, 'timestamp':timestamp, 'timestr':fmtDate(timestamp)})
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
    s.creationStr = fmtDate(s.creation)
    s.lastchange = fmtDate(latest)
    s.steps = stepList
    s.labbookRaw = text
    s.labbook = marked.parse(text)
    s.isGoodSample = fs.existsSync(path.join(dbDir, name, 'good-sample'))
    s.isBadSample = fs.existsSync(path.join(dbDir, name, 'bad-sample'))
  }
  catch(err) {
    console.log(err)
    return false
  }
  return s
}

function escapeRegExp(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

function getNextSampleName() {
  let samples = getAllSamples()
  let r = RegExp(escapeRegExp(cfg.database.samplePrefix)+'(\\d+)')

  // set first candidate to largest found sample number in db
  let candidate = 0
  for (let s in samples) {
    let m = r.exec(samples[s].name)
    if (m) {
      candidate = Math.max(candidate, Number(m[1]))
    }
  }
  // increment candidate by one
  candidate += 1

  // return sanitized candidate
  return sanitize(cfg.database.samplePrefix+lpad(candidate, 3))
}

function getAllTemplates() {
  let templates = []
  const dir = path.join(dbDir, 'templates')
  if(fs.existsSync(dir)) {
    fs.readdirSync(dir).forEach(file => {
      if(file.endsWith(".txt") && sanitize(file) == file) {
        templates.push(file.split('.')[0])
      }
    })
  }
  return templates
}

function getTemplate(name) {
  name = sanitize(name)
  try {
    let text = fs.readFileSync(dbDir+'/templates/'+name+'.txt', 'utf8').split('\n')
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
    console.log(err)
    return {name: "", description: ""}
  }
}

function fileOrDirExists(path, regex) {
  let m = [null]
  fs.readdirSync(path).some(file => {
    m[0] = file.match(regex)
    if(m[0]) {
      return Boolean(m[0])
    }
  })
  return m[0]?m[0][0]:false
}

function findImgs(detailSample) {
  detailSample = sanitize(detailSample)
  return _find(path.join(dbDir, detailSample), IMG_FORMATS, true)
}

function hasImgs(detailSample) {
  detailSample = sanitize(detailSample)
  return _find(path.join(dbDir, detailSample), IMG_FORMATS, false).length > 0
}

function _find(startPath, suffixes, findAll) {
  if (!fs.existsSync(startPath)) {
    return []
  }
  const result = []
  const files = fs.readdirSync(startPath).sort().reverse()
  for(let i=0; i<files.length; i++) {
    const filename = startPath + '/' + files[i]
    if (fs.lstatSync(filename).isDirectory()){
      result.push(..._find(filename, suffixes, findAll))
      if (!findAll && result.length > 0) {
        return result
      }
    }
    else {
      for(let j=0; j<suffixes.length; j++) {
        if(filename.toLowerCase().endsWith('.'+suffixes[j])) {
          result.push(filename)
          if (!findAll && result.length > 0) {
            return result
          }
          break
        }
      }
    }
  }
  return result
}

function makeNonExistingPath(path) {
  let spath = path.split('.')
  let start = spath[0]
  let end = ''
  if (spath.length > 1) {
    start = spath.slice(0, spath.length-1)
    end = '.'+spath[spath.length-1]
  }
  let suff = ''
  let i = 0
  while (fs.existsSync(start+suff+end)) {
    i++;
    suff = '-'+i
  }
  return start+suff+end
}

let warnings = []
let loggedIn = false
let lastHeartbeat = Date.now()+10000

if(cfg.app.autoQuit) {
  setInterval(function() {
    if (Date.now()-lastHeartbeat > 15000) {
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
    let newName = getNextSampleName()
    fse.mkdirpSync(path.join(dbDir, newName));
    let aim = req.query.aim.trim()
    if(aim != '') {
      aim = ' - '+aim
    }
    const labbookPath = path.join(dbDir, newName, LABBOOK_FILENAME)
    if(!fs.existsSync(labbookPath)) {
      fs.writeFileSync(labbookPath, newName + aim + '\n'
                        + Array(newName.length+aim.length+1).join("=")
                        + '\n\n');
    }
    res.redirect("/"+newName)
    next = function() {}
    break;

  case "add-step":
    let args = req.params.step.split("?")[1]
    let date = req.query.date.trim()
    let name = req.query.name.trim()
    let description = req.query.description.trim()

    // reformat description properly
    if(description.length > 0) {
      description = '\n' + description
      let reg = /\s*\n+(\s*)/g
      let minIndentLevel = 9999

      // find min indentation
      let m = undefined
      while(m = reg.exec(description)) {
        minIndentLevel = Math.min(minIndentLevel, Math.floor(m[1].length/2)+1);
      }

      // typeset indentation
      while(m = reg.exec(description)) {
        description = description.substr(0,m.index)
            + '\n' + Array(Math.floor(m[1].length/2)+1-minIndentLevel)
                                                  .join('  ') + '  * '
            + description.substr(m.index+m[0].length)
      }
      description = description.substr(1)
    }
    description += '\n'

    // parse date and check if passed date is valid
    if(date) {
      m = date.match(/(\d+)\.(\d+)/)
      if(m) {
        let _date = date.replace(/\d+\.\d+/, m[2]+'.'+m[1])
        console.log('converted date string to european format '+date+' -> '+_date)
        date = Date.parse(_date)
      }
      else {
        const d = new Date(Date.now())
        let _date = d.getMonth()+'.'+d.getDate()+'. '+date
        console.log('added todays date and month to date string '+date+' -> '+_date)
        date = Date.parse(_date)
      }
    }
    else {
      date = Date.now()
    }
    if(isNaN(date)) {
      warnings.push('Failed to parse date, please use a format like: "dd.mm. HH:MM".')
      break;
    }

    // check if name length is valid
    if(name.length < 3) {
      warnings.push("Step name must have at least 3 characters")
      break;
    }

    // check if description is free of _ placeholders
    if(req.query.description.match(/_/)) {
      warnings.push("Please fill in all placeholders in step description.")
      break;
    }
    let sample = getSampleDetail(req.params.detailSample)

    let s = sample.labbookRaw
    let nextId = 1
    if(sample.steps.length > 0) {
      nextId = sample.steps[0].id + 1
    }
    let text = "* "+fmtDate(date)+' '+fmtTime(date)
               +' - '+lpad(nextId, cfg.database.stepIdLen)
               +' - '+name+'\n'+description+'\n'
    let m = /.*\n={3,}\n+/m.exec(s)
    if(!m) {
      m = /^#.*\n+/m.exec(s)
      if(!m) {
        warnings.push("Invalid labbook, cannot save.")
        break;
      }
    }
    let pos = m.index + m[0].length
    let newLabbook = s.substr(0,pos) + text + s.substr(pos)
    fs.writeFileSync(dbDir+'/'+sanitize(req.params.detailSample)+'/labbook.md',
                     newLabbook)
    res.redirect("/"+sanitize(req.params.detailSample))
    next = function() {}

  case "load-template":
    let t = getTemplate(req.query['temp-name'])
    if(t.name) {
      res.redirect("/"+sanitize(req.params.detailSample)
          +'?name='+encodeURIComponent(t.name)
          +'&description='+encodeURIComponent(t.description))
      next = function() {}
    }

  case "import-files":
    let stepid = Number(req.query.stepid)
    break

  case "upload-form":
    res.render('form', {
      'detailSample': getSampleDetail(req.params.detailSample),
      'status': 'neutral'
    })
    next = function() {}
    break;

  case "img":
    let imgNum = (Number(req.query.id) || Number(0)).toFixed(0)
    let imgs = findImgs(req.params.detailSample)
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

  // make sure upload folder exists if database
  // was already created
  if(fs.existsSync(dbDir) && uploadDir) {
    fse.mkdirpSync(uploadDir)
  }

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
      'formDate': req.query.date,
      'imgsPerPage': req.query.imgsPerPage || 50,
      'imgPage': req.query.imgPage || 1,
      'formDescription': req.query.description,
      'templates': getAllTemplates(),
      'warnings': warnings,
      'loggedIn': loggedIn,
      'imgCount': findImgs(req.params.detailSample).length
    });
  }
  warnings = []
});

router.get('/', function(req, res, next) {
  var s = getAllSamples()
  if(s.length > 0) {
    res.redirect('/'+sanitize(s[0].name))
  }
  else {
    res.redirect('/none')
  }
})

router.post('/:detailSample/',
            upload.fields([{ name: 'file', maxCount: 24 }]),
            function(req, res, next) {

  const ups = req.files.file
  const imgCountBefore = findImgs(req.params.detailSample).length
  if(ups || req.body.useuploadfolder) {

    var basePath = path.join(dbDir, sanitize(req.params.detailSample))
    var stepid = req.body.stepid

    var detail = getSampleDetail(req.params.detailSample)
    if(stepid <= 0 || stepid != Number(stepid).toFixed(0)) {
      stepid = detail.steps[0].id
    }

    var dir = fileOrDirExists(basePath, RegExp("^"+lpad(stepid, cfg.databasegstepIdLen)+".*$"))
    if(!dir) {
      var step = detail.steps.find(function(t) {return t.id == Number(stepid)})
      var w = step.title.split(" ")
      var shortTitle = ""
      var maxLen = 0
      for(let i=0; i<w.length; i++) {
        if(w[i].length > maxLen) {
          maxLen = w[i].length
          shortTitle = w[i].toLowerCase()
        }
      }
      dir = sanitize(lpad(stepid, cfg.database.stepIdLen) + "-" + shortTitle)
    }
    try {
      fs.mkdirSync(basePath+"/"+dir)
    }
    catch (e) {}

    if(ups) {
      for(let i=0; i<ups.length; i++) {
        const name = ups[i].originalname
        const tarPath = makeNonExistingPath(path.join(basePath, dir, name))
        try {
          fse.moveSync(ups[i].path, tarPath)
        }
        catch(err) {
          console.log(err)
          warnings.push("Failed to upload '"+name+"'")
        }
      }
    }
    else {
      let count = Number(req.body.filecount)
      if(!count) {
        count = 255
      }
      if(uploadDir) {
        fse.mkdirpSync(uploadDir)
        let files = fs.readdirSync(uploadDir).sort()
        for(let i=0; i<files.length && i<count; i++) {
          const tarPath = makeNonExistingPath(path.join(basePath, dir, files[i]))
          fse.moveSync(path.join(uploadDir, files[i]), tarPath)
        }
      }
      else {
        warnings.push("database.updloadDir in the configuration file is not set.")
      }
    }
  }
  const imgCountNow = findImgs(req.params.detailSample).length
  res.render('form', {
    'detailSample': getSampleDetail(req.params.detailSample),
    'triggerRefresh': warnings.length > 0
                        || (imgCountBefore != imgCountNow),
    'status': 'success'
  })
})

export default router 
