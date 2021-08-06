fs = require('fs')
fse = require('fs-extra')
path = require('path')
YAML = require('yaml')
deepmerge = require('deepmerge')

const BASE_PATH = __dirname.startsWith('/snapshot') ? path.dirname(process.execPath) : __dirname+'/../'
const CONFIG_PATH = path.join(BASE_PATH, 'sampleman-config.txt');
const DEFAULT_CFG = {
  "database": {
    "baseDir": "~/Documents/samples",
    "uploadDir": "~/Documents/sampleman-uploads",
    "samplePrefix": "XYZ",
    "stepIdLen": 3
  },
  "app": {
    "autoQuit": true
  },
  "http": {
    "accessToken": "",
    "host": "localhost",
    "port": 3000
  }
}

let config = {}
try {
  config = YAML.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
}
catch(e) {
  // on error, move corrupt config file and create
  // new config file with default values
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

config = deepmerge(DEFAULT_CFG, config)
fse.mkdirpSync(path.dirname(CONFIG_PATH))
fs.writeFileSync(CONFIG_PATH, YAML.stringify(config, 'utf8'))

module.exports = config

