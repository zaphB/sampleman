fs = require('fs')
fse = require('fs-extra')
path = require('path')
const os = require('os');
deepmerge = require('deepmerge')
YAML = require('yaml')

const BASE_PATH = writablePath([path.join(__dirname, '..'),
                                process.execPath])

const CONFIG_PATH = path.join(BASE_PATH, 'sampleman.config.txt');

const DEFAULT_CFG = {
  "database": {
    "baseDir": "~/Documents/samples",
    "uploadDir": "",
    "samplePrefix": "XYZ",
    "stepIdLen": 3
  },
  "app": {
    "autoQuit": true
  },
  "http": {
    "accessToken": "",
    "public": false,
    "port": 3000
  }
}

// get first writable path from list of directories
function writablePath(candidates) {
  for(let i=0; i<candidates.length;i++) {
    let c = absolutePath(candidates[i])
    if(isWritable(c)) {
      return c
    }
  }
  return ''
}

// check if directory path p is writable
function isWritable(p) {
  // test if within snapshot filesystem of binary
  if(/^([A-Za-z]+:)?[\\/]snapshot/.test(p)) {
    return false
  }

  // test if writable by creating tmpfile
  const tmpfile = path.join(p, '.tmpfile'+Date().now)
  try {
    fs.writeFileSync(tmpfile, 'tmp')
    fs.unlinkSync(tmpfile)
    return true
  }
  catch {}
  return false
}

// expand ~ in path p and convert to absolute path
function absolutePath(p) {
  if(p.startsWith('~')) {
    p = p.replace('~', os.homedir()+'/')
  }
  if(!path.isAbsolute(p)) {
    p = path.join(BASE_PATH, p)
  }
  return path.normalize(p)
}

// try load config file and create default config on error
let config = {}
try {
  config = YAML.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
}
catch(e) {
  console.error('failed to read/parse config file ('+e+')');
  let i = '';
  while (fs.existsSync(CONFIG_PATH+'.err'+i)) {
    i = (i || 0) + 1
  }
  try {
    fs.renameSync(CONFIG_PATH, CONFIG_PATH+'.err'+i)
  }
  catch {}
}

// deepmerge config object with default values and write to disk
config = deepmerge(DEFAULT_CFG, config)
fs.writeFileSync(CONFIG_PATH, YAML.stringify(config, 'utf8'))

module.exports = {
  ...config,
  'absolutePath': absolutePath
}
