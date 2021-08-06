#!/bin/bash

# change dir to this script's location
cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")"

# check if repo is clean or need commit
git update-index --refresh >/dev/null 2>&1
if git diff-index --quiet HEAD --; then
  sleep 0
else
  echo "uncommitted changes exist in repo, please commit everything before building."
  exit 2
fi

# install latest pkg version
echo installing latest version of pkg bundler
sudo npm install --global pkg 
echo '------------------------------------------------------'
echo 

# check if pkg binary is available
if pkg --help >/dev/null 2>&1; then
  sleep 0
else
  echo "pkg bundler not found on your PATH."
  exit 1
fi 

# find current sampleman version from git tags
sampleManVersion="$(git tag --points-at "$(git branch --show-current)" | grep '^v')"
installedNodeVersion="$(node --version | grep -oP '\d+\.\d+\.\d+')"
if [[ "$sampleManVersion" == "" ]]; then
  echo "current commit is not tagged as a release, building as 'interim'"
  sampleManVersion='interim'
else
  echo "BUILDING SAMPLEMAN $sampleManVersion RELEASES"
fi
echo "node --version is v$(node --version | grep -oP '\d+\.\d+\.\d+')"
echo

# build targets 
for target in "linux-x64" "win-x64" "macos-x64" "macos-arm64"; do

  echo "begin building target $target..."

  # check latest nodejs prebuilt binary version
  npm install --no-save semver-sort >/dev/null 2>&1
  echo "const s = require('semver-sort'); \
        console.log(s.desc(process.argv.slice(2))[0])" >.tmp-script.js
  latest="$(node .tmp-script.js $(curl "https://github.com/vercel/pkg-fetch/releases" 2>/dev/null \
              | grep -oP '\d+\.\d+\.\d+-'"$target" | grep -oP '\d+\.\d+\.\d+'))"
  rm .tmp-script.js
  echo "> using prebuilt node v$latest"

  mkdir -p releases/
  outname="sampleman-$sampleManVersion-$target-node$latest"
  pkg . --targets "node$latest-$target" \
        --output "releases/$outname" \
          | grep -i "error!"
  if [[ "${PIPESTATUS[0]}" == "0" ]]; then
    created="$created\n> $outname"
    echo "> done."
  else 
    echo "> failed."
  fi
  echo
done

# report how many binaries were created
if [[ "$created" == "" ]]; then
  echo "no binaries were created."
else
  echo -e "created $(echo -e "$created" | sed '/^\s*$/d' | wc -l) binaries in ./releases/: $created"
fi

