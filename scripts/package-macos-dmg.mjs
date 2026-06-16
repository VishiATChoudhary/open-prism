import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageJsonPath = join(rootDir, 'package.json')
const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'))

const productName = pkg.productName || 'Open Prism'
const appId = pkg.build?.appId || 'dev.openprism.app'
const version = pkg.version || '0.0.0'
const arch = process.arch
const electronAppPath = join(rootDir, 'node_modules', 'electron', 'dist', 'Electron.app')
const distDir = join(rootDir, 'dist')
const macDir = join(distDir, 'macos')
const dmgStageDir = join(distDir, 'dmg-stage')
const appPath = join(macDir, `${productName}.app`)
const resourcesDir = join(appPath, 'Contents', 'Resources')
const appResourcesDir = join(resourcesDir, 'app')
const plistPath = join(appPath, 'Contents', 'Info.plist')
const appExecutablePath = join(appPath, 'Contents', 'MacOS', productName)
const electronExecutablePath = join(appPath, 'Contents', 'MacOS', 'Electron')
const safeProductName = productName.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
const dmgPath = join(distDir, `${safeProductName}-${version}-mac-${arch}.dmg`)

function run(command, args, options = {}) {
  execFileSync(command, args, { stdio: 'inherit', ...options })
}

function setPlist(key, type, value) {
  const plistBuddy = '/usr/libexec/PlistBuddy'
  try {
    execFileSync(plistBuddy, ['-c', `Set :${key} ${value}`, plistPath])
  } catch {
    execFileSync(plistBuddy, ['-c', `Add :${key} ${type} ${value}`, plistPath])
  }
}

function makeIcon() {
  const iconSource = join(rootDir, 'resources', 'app-icon.png')
  if (!existsSync(iconSource)) return false

  const iconset = join(distDir, 'app.iconset')
  const icnsPath = join(resourcesDir, 'app.icns')
  rmSync(iconset, { recursive: true, force: true })
  mkdirSync(iconset, { recursive: true })

  const icons = [
    [16, 'icon_16x16.png'],
    [32, 'icon_16x16@2x.png'],
    [32, 'icon_32x32.png'],
    [64, 'icon_32x32@2x.png'],
    [128, 'icon_128x128.png'],
    [256, 'icon_128x128@2x.png'],
    [256, 'icon_256x256.png'],
    [512, 'icon_256x256@2x.png'],
    [512, 'icon_512x512.png'],
    [1024, 'icon_512x512@2x.png']
  ]

  for (const [size, fileName] of icons) {
    run('sips', ['-z', String(size), String(size), iconSource, '--out', join(iconset, fileName)], { stdio: 'ignore' })
  }
  try {
    run('iconutil', ['-c', 'icns', iconset, '-o', icnsPath])
    return true
  } catch {
    console.warn('Warning: app icon conversion failed; packaging will continue with the default Electron icon.')
    return false
  } finally {
    rmSync(iconset, { recursive: true, force: true })
  }
}

if (process.platform !== 'darwin') {
  throw new Error('macOS DMG packaging must be run on macOS.')
}

if (!existsSync(electronAppPath)) {
  throw new Error(`Electron.app was not found at ${electronAppPath}. Run npm install first.`)
}

rmSync(macDir, { recursive: true, force: true })
rmSync(dmgStageDir, { recursive: true, force: true })
mkdirSync(macDir, { recursive: true })
mkdirSync(distDir, { recursive: true })

cpSync(electronAppPath, appPath, { recursive: true, verbatimSymlinks: true })
if (existsSync(electronExecutablePath)) {
  rmSync(appExecutablePath, { force: true })
  cpSync(electronExecutablePath, appExecutablePath)
  rmSync(electronExecutablePath, { force: true })
}

rmSync(join(resourcesDir, 'default_app.asar'), { force: true })
mkdirSync(appResourcesDir, { recursive: true })
cpSync(join(rootDir, 'out'), join(appResourcesDir, 'out'), { recursive: true })
cpSync(join(rootDir, 'resources'), join(appResourcesDir, 'resources'), { recursive: true })
writeFileSync(
  join(appResourcesDir, 'package.json'),
  `${JSON.stringify(
    {
      name: pkg.name,
      productName,
      version,
      description: pkg.description,
      license: pkg.license,
      main: pkg.main,
      type: pkg.type
    },
    null,
    2
  )}\n`
)

const hasAppIcon = makeIcon()
setPlist('CFBundleName', 'string', productName)
setPlist('CFBundleDisplayName', 'string', productName)
setPlist('CFBundleExecutable', 'string', productName)
setPlist('CFBundleIdentifier', 'string', appId)
setPlist('CFBundleShortVersionString', 'string', version)
setPlist('CFBundleVersion', 'string', version)
if (hasAppIcon) setPlist('CFBundleIconFile', 'string', 'app.icns')

run('codesign', ['--force', '--deep', '--sign', '-', appPath])

mkdirSync(dmgStageDir, { recursive: true })
cpSync(appPath, join(dmgStageDir, `${productName}.app`), { recursive: true, verbatimSymlinks: true })
symlinkSync('/Applications', join(dmgStageDir, 'Applications'))
rmSync(dmgPath, { force: true })
run('hdiutil', ['create', '-volname', productName, '-srcfolder', dmgStageDir, '-ov', '-format', 'UDZO', dmgPath])

console.log(`Created ${dmgPath}`)
