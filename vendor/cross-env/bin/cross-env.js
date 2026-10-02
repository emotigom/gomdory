#!/usr/bin/env node

const { spawn } = require('node:child_process')

const args = process.argv.slice(2)
if (args.length === 0) {
  process.exit(0)
}

const env = { ...process.env }
let commandIndex = 0

for (; commandIndex < args.length; commandIndex += 1) {
  const arg = args[commandIndex]
  if (!arg.includes('=') || arg.startsWith('=')) {
    break
  }

  const separatorIndex = arg.indexOf('=')
  const key = arg.slice(0, separatorIndex)
  const value = arg.slice(separatorIndex + 1)

  if (!key) {
    break
  }

  env[key] = value
}

if (commandIndex >= args.length) {
  process.exit(0)
}

const command = args[commandIndex]
const commandArgs = args.slice(commandIndex + 1)

const child = spawn(command, commandArgs, {
  env,
  stdio: 'inherit',
  shell: true,
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})

child.on('error', (error) => {
  console.error(error)
  process.exit(1)
})
