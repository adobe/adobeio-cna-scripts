/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const fs = require('fs-extra') // promises
const path = require('path')
const execa = require('execa')
const archiver = require('archiver')

async function installDeps (folder) {
  if (!((await fs.stat(folder)).isDirectory() && (await fs.readdirSync(folder)).includes('package.json'))) {
    throw new Error(`${folder} is not a valid directory with a package.json file.`)
  }
  // npm install
  await execa('npm', ['install', '--no-package-lock'], { cwd: folder })
}

async function spawnAioRuntimeDeploy (manifestFile, ...cmd) {
  // for now this is a tmp hack so that ~/.wskprops does not interfer AIO properties
  const fakeWskProps = path.resolve('.fake-wskprops')
  await fs.writeFile(fakeWskProps, '')
  process.env['WSK_CONFIG_FILE'] = fakeWskProps

  try {
    // aio reads .aio runtime config
    await execa(`aio`, [
      'runtime',
      'deploy',
      ...cmd,
      '-m', manifestFile
    ]
    )
  } finally {
    // hack end remove fake props file
    await fs.unlink(fakeWskProps)
  }
}

/**
 * Zip a folder using archiver
 * @param {String} dir
 * @param {String} out
 * @returns {Promise}
 */
function zipFolder (dir, out) {
  const stream = fs.createWriteStream(out)
  const archive = archiver('zip', { zlib: { level: 9 } })

  return new Promise((resolve, reject) => {
    stream.on('close', () => resolve())
    archive.pipe(stream)
    archive.on('error', err => reject(err))
    archive.directory(dir, false)
    archive.finalize()
  })
}

/**
 * Joins url path parts
 * @param {...string} args url parts
 * @returns {string}
 */
function urlJoin (...args) {
  let start = ''
  if (args[0] && args[0].startsWith('/')) start = '/'
  return start + args.map(a => a && a.replace(/(^\/|\/$)/g, '')).filter(a => a).join('/')
}

module.exports = {
  zipFolder: zipFolder,
  urlJoin: urlJoin,
  installDeps: installDeps,
  spawnAioRuntimeDeploy: spawnAioRuntimeDeploy
}
