#!/bin/bash
cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")"

# simply start
npm start || ( \
\
# if it fails, try npm install and then start
  npm install && npm start || ( \
\
# if that also failes remove node modules and then try npm install and start
    rm -rf node_modules && npm install && npm start))
