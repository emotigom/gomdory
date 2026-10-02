const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

const css = fs.readFileSync('app/globals.css', 'utf8')

test('hud top/right shells do not use full-shell PNG backgrounds', () => {
  assert.match(css, /html\[data-theme="hud"\] \.hud-top-chrome::before \{[\s\S]*background-image: linear-gradient\(/)
  assert.match(css, /html\[data-theme="hud"\] \.hud-right-rail::before \{[\s\S]*background-image:[\s\S]*linear-gradient\(/)
  assert.doesNotMatch(css, /html\[data-theme="hud"\] \.hud-top-chrome::before \{[^}]*var\(--hud-top-bar\)/)
  assert.doesNotMatch(css, /html\[data-theme="hud"\] \.hud-right-rail::before \{[^}]*var\(--hud-right-panel\)/)
})
