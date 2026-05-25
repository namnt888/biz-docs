import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import readline from 'node:readline'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const dotenv = require('../agent/node_modules/dotenv')

const __dirname = dirname(fileURLToPath(import.meta.url))
const claspPath = join(__dirname, '.clasp.json')
const repoRoot = join(__dirname, '..')
const homeDir = process.env.HOME || process.env.USERPROFILE
const globalClasprcPath = join(homeDir, '.clasprc.json')
const expectedClaspEmail = (process.env.CLASP_EMAIL || 'namnt05@gmail.com').trim().toLowerCase()

const args = process.argv.slice(2)
const getFlagValue = (flag) => {
  const direct = args.find((arg) => arg.startsWith(`${flag}=`))
  if (direct) return direct.split('=').slice(1).join('=')
  const index = args.indexOf(flag)
  if (index >= 0 && args[index + 1]) return args[index + 1]
  return null
}

const scriptIdArg = getFlagValue('--script-id') || getFlagValue('--id') || args.find((arg) => !arg.startsWith('--'))
const profileArg = getFlagValue('--profile') || getFlagValue('--name')
const indexArg = getFlagValue('--index') || getFlagValue('--pick')
const forceFlag = args.includes('--force') ? true : args.includes('--no-force') ? false : true
const allFlag = args.includes('--all')

const ask = (question) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })

const resolveCurrentClaspEmail = async () => {
  try {
    if (!existsSync(globalClasprcPath)) return null
    const creds = JSON.parse(readFileSync(globalClasprcPath, 'utf8'))
    const accessToken = creds?.tokens?.default?.access_token
    if (!accessToken) return null

    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) return null
    const payload = await response.json()
    return typeof payload?.email === 'string' ? payload.email.trim().toLowerCase() : null
  } catch {
    return null
  }
}

const isLikelyScriptId = (value) => /^[a-zA-Z0-9_-]{20,}$/.test(value)

const useShell = process.platform === 'win32'

const loadEnv = () => {
  const envPath = join(repoRoot, 'agent', '.env')
  const envLocalPath = join(repoRoot, 'agent', '.env.local')
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false })
  }
  if (existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath, override: true })
  }
}

const prefixArg = getFlagValue('--prefix')

const buildProfiles = () => {
  const profiles = []
  for (const [key, value] of Object.entries(process.env)) {
    if (!value) continue
    if (!/script/i.test(key)) continue

    if (prefixArg && !key.startsWith(prefixArg)) continue

    const trimmed = value.trim()
    if (!isLikelyScriptId(trimmed)) continue
    const lowerKey = key.toLowerCase()

    let alias = lowerKey
    if (prefixArg) {
      alias = alias.replace(prefixArg.toLowerCase(), '')
    }
    alias = alias
      .replace(/^clasp_/, '')
      .replace(/^script_id_/, '')
      .replace(/^script_/, '')
      .replace(/_script_id$/, '')
      .replace(/_script$/, '')

    profiles.push({
      key,
      value: trimmed,
      aliases: [lowerKey, alias],
    })
  }
  return profiles
}

const resolveProfile = (profiles, name) => {
  if (!name) return null
  const normalized = name.toLowerCase()
  return profiles.find((profile) => profile.aliases.includes(normalized) || profile.key.toLowerCase() === normalized) || null
}

const toIndex = (value) => {
  if (value === null || value === undefined) return null
  const numeric = Number.parseInt(String(value).trim(), 10)
  if (Number.isNaN(numeric)) return null
  return numeric
}

const selectByIndex = (profiles, index) => {
  if (!index) return null
  if (index < 1 || index > profiles.length) return null
  return { index, profile: profiles[index - 1] }
}

const selectionFromProfile = (profiles, profile) => {
  if (!profile) return null
  const index = profiles.findIndex((item) => item.key === profile.key)
  return { index: index >= 0 ? index + 1 : null, profile }
}

const chooseProfile = async (profiles) => {
  if (!profiles.length) {
    if (prefixArg) {
      console.log(`No profiles found matching prefix: "${prefixArg}".`)
      console.log('Available keys in env:', Object.keys(process.env).filter(k => /script/i.test(k)).join(', '))
    }
    return null
  }
  console.log('\nAvailable script IDs:')
  profiles.forEach((profile, index) => {
    console.log(`${index + 1}) ${profile.key}`)
  })
  
  const timeoutSeconds = 5
  let remaining = timeoutSeconds
  
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    
    const timer = setInterval(() => {
      remaining--
      if (remaining <= 0) {
        clearInterval(timer)
        rl.close()
        process.stdout.write('\n\n⏰ Timeout! Auto-selecting ALL...\n')
        resolve('ALL')
      } else {
        updatePrompt()
      }
    }, 1000)

    const updatePrompt = () => {
      readline.cursorTo(process.stdout, 0)
      readline.clearLine(process.stdout, 0)
      process.stdout.write(`Choice (1-${profiles.length}, Script ID or Enter for ALL) [Auto-ALL in ${remaining}s]: `)
    }

    updatePrompt()

    rl.on('line', (line) => {
      const answer = line.trim()
      clearInterval(timer)
      rl.close()

      if (answer === '') {
        resolve('ALL')
        return
      }

      const index = toIndex(answer)
      const byIndex = selectByIndex(profiles, index)
      if (byIndex) {
        resolve(byIndex)
        return
      }
      if (isLikelyScriptId(answer)) {
        resolve(answer)
        return
      }
      
      const resolved = resolveProfile(profiles, answer)
      const selection = selectionFromProfile(profiles, resolved)
      if (selection) {
        resolve(selection)
        return
      }
      
      resolve(null)
    })
  })
}

// Clasp command runner helper using npx @google/clasp
const runClasp = (argsList) => {
  const claspCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  return spawnSync(claspCmd, ['@google/clasp', ...argsList], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: useShell,
  })
}

const main = async () => {
  loadEnv()
  const activeClaspEmail = await resolveCurrentClaspEmail()

  if (activeClaspEmail) {
    console.log(`Active clasp account: ${activeClaspEmail}`)
    if (expectedClaspEmail && activeClaspEmail !== expectedClaspEmail) {
      console.log(`\n❌ clasp account mismatch.`)
      console.log(`Expected: ${expectedClaspEmail}`)
      console.log(`Actual:   ${activeClaspEmail}`)
      console.log(`Run 'npx @google/clasp login' with the expected account, then retry.`)
      process.exit(1)
    }
  } else {
    console.log('⚠️ Unable to resolve active clasp account email from token. Continuing...')
  }

  const profiles = buildProfiles()

  if (profiles.length === 0 && prefixArg) {
    console.log(`No profiles found matching prefix: "${prefixArg}".`)
    const allEnvKeys = Object.keys(process.env).filter(k => /script/i.test(k))
    console.log('Available keys in env (containing "script"):', allEnvKeys.join(', '))
  }

  const lifecycleEvent = process.env.npm_lifecycle_event || ''
  const lifecycleMatch = lifecycleEvent.match(/:(\d+)$/)
  const lifecycleIndex = lifecycleMatch ? toIndex(lifecycleMatch[1]) : null

  let selected = null
  let scriptId = ''

  const directIndex = toIndex(scriptIdArg)
  if (directIndex) {
    selected = selectByIndex(profiles, directIndex)
    scriptId = selected?.profile?.value ?? ''
  }

  if (!scriptId && scriptIdArg && isLikelyScriptId(scriptIdArg)) {
    scriptId = scriptIdArg
  }

  if (!scriptId && scriptIdArg) {
    const resolved = resolveProfile(profiles, scriptIdArg)
    const selection = selectionFromProfile(profiles, resolved)
    if (selection) {
      selected = selection
      scriptId = selection.profile.value
    }
  }

  if (!scriptId && process.env.CLASP_SCRIPT_ID) {
    const envValue = process.env.CLASP_SCRIPT_ID
    if (envValue && isLikelyScriptId(envValue)) {
      scriptId = envValue
    } else {
      const resolved = resolveProfile(profiles, envValue)
      const selection = selectionFromProfile(profiles, resolved)
      if (selection) {
        selected = selection
        scriptId = selection.profile.value
      }
    }
  }

  if (!scriptId && profileArg) {
    const resolved = resolveProfile(profiles, profileArg)
    const selection = selectionFromProfile(profiles, resolved)
    if (selection) {
      selected = selection
      scriptId = selection.profile.value
    }
  }

  if (!scriptId && indexArg) {
    selected = selectByIndex(profiles, toIndex(indexArg))
    scriptId = selected?.profile?.value ?? ''
  }

  if (!scriptId && lifecycleIndex) {
    selected = selectByIndex(profiles, lifecycleIndex)
    scriptId = selected?.profile?.value ?? ''
  }

  if (!scriptId && profiles.length) {
    const selection = allFlag ? 'ALL' : await chooseProfile(profiles)

    if (selection === 'ALL') {
      console.log(`\nPushing to ALL ${profiles.length} profiles...\n`)
      let successCount = 0
      let failCount = 0

      for (let i = 0; i < profiles.length; i++) {
        const profile = profiles[i]
        const indexLabel = `${i + 1}/${profiles.length}`

        console.log(`\n[${indexLabel}] Pushing to ${profile.key}...`)

        const raw = readFileSync(claspPath, 'utf8')
        const config = JSON.parse(raw)
        config.scriptId = profile.value
        writeFileSync(claspPath, JSON.stringify(config, null, 2) + '\n')

        const pushArgs = ['push']
        if (forceFlag) pushArgs.push('--force')

        let result = runClasp(pushArgs)

        if (result.status === 0) {
          console.log(`[${indexLabel}] ${profile.key} ✅ PUSHED`)
          successCount++

          const deployEnvKey = profile.key.replace('_SCRIPT_', '_DEPLOY_')
          const deployId = process.env[deployEnvKey]

          if (deployId) {
            console.log(`   🚀 Auto-deploying to ${deployId}...`)
            const deployResult = runClasp([
              'deploy',
              '--deploymentId', deployId,
              '--description', 'Auto-updated_via_script'
            ])

            if (deployResult.status === 0) {
              console.log(`   ✨ [${new Date().toLocaleString()}] Deployed Successfully!`)
            } else {
              console.log(`   ⚠️ Deploy Failed (Exit Code: ${deployResult.status})`)
            }
          } else {
            console.log(`   ℹ️ No deploy ID found for ${profile.key} (Expected: ${deployEnvKey})`)
          }
        } else {
          console.log(`[${indexLabel}] ${profile.key} ❌ PUSH FAILED`)
          const emailForMessage = activeClaspEmail || expectedClaspEmail || 'your clasp account'
          console.log(`\nPush to ${profile.key} failed. This is likely a permission issue for ${emailForMessage}.`)
          console.log(`Please ensure the script ID (${profile.value}) is shared with ${emailForMessage} as Editor.`)
          failCount++
        }
      }

      console.log(`\n📊 Summary: ${successCount} succeeded, ${failCount} failed`)
      process.exit(failCount > 0 ? 1 : 0)
    }

    if (selection && typeof selection === 'object' && selection.profile) {
      selected = selection
      scriptId = selection.profile.value
    } else if (typeof selection === 'string') {
      scriptId = selection
    }
  }

  if (!scriptId) {
    scriptId = await ask('Enter Apps Script ID to push to: ')
  }
  if (!scriptId) {
    console.error('Missing script ID. Aborting.')
    process.exit(1)
  }

  if (selected?.profile?.key) {
    const indexLabel = selected.index ? `${selected.index}) ` : ''
    console.log(`Selected: ${indexLabel}${selected.profile.key}`)
  }

  const raw = readFileSync(claspPath, 'utf8')
  const config = JSON.parse(raw)
  config.scriptId = scriptId
  writeFileSync(claspPath, JSON.stringify(config, null, 2) + '\n')

  const pushArgs = ['push']
  if (forceFlag) pushArgs.push('--force')

  let result = runClasp(pushArgs)

  // Retry logic for single push
  if (result.status !== 0 && selected?.profile?.key) {
    console.log(`\nPush failed. This is likely a permission issue for ${expectedClaspEmail}.`)
    const loginChoice = await ask(`Would you like to run 'npx @google/clasp login' to refresh your token and retry? (y/n): `)

    if (loginChoice.toLowerCase() === 'y') {
      console.log(`\nRunning 'npx @google/clasp login'... Please refresh your session.`)
      const loginResult = runClasp(['login'])

      if (loginResult.status === 0) {
        console.log(`Retrying push...`)
        result = runClasp(pushArgs)
      }
    }
  }

  if (selected?.profile?.key) {
    const indexLabel = selected.index ? `${selected.index}) ` : ''
    const statusLabel = result.status === 0 ? 'PUSHED' : 'PUSH FAILED'
    console.log(`${indexLabel}${selected.profile.key} ${statusLabel}`)
  }

  // AUTO-DEPLOY LOGIC FOR SINGLE PUSH
  if (result.status === 0) {
    let profileKey = selected?.profile?.key
    if (!profileKey) {
      const found = profiles.find(p => p.value === scriptId)
      if (found) profileKey = found.key
    }

    if (profileKey) {
      const deployEnvKey = profileKey.replace('_SCRIPT_', '_DEPLOY_')
      const deployId = process.env[deployEnvKey]

      if (deployId) {
        console.log(`   🚀 Auto-deploying to ${deployId}...`)

        const deployResult = runClasp([
          'deploy',
          '--deploymentId', deployId,
          '--description', 'Auto-updated_via_script'
        ])

        if (deployResult.status === 0) {
          const deployingTime = new Date().toLocaleString()
          console.log(`   ✨ [${deployingTime}] Deployed Successfully!`)
        } else {
          console.log(`   ⚠️ Deploy Failed (Exit Code: ${deployResult.status})`)
        }
      } else {
        console.log(`   ℹ️ No deploy ID found for ${profileKey} (Expected: ${deployEnvKey})`)
      }
    }
  }

  process.exit(result.status ?? 0)
}

main()
