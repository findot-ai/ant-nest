import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'ant-nest',
  component: 'Pane',
  requestId: 'ant-nest',
  props: { title: '개미굴', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

test('the nest pane draws on every surface', async ($, on) => {
  on('command.register', () => ({ value: { command: 'ant' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))
  on('clock.every', () => ({ value: undefined }))
  const store: Record<string, unknown> = {}
  on('store.get', (_, e) => ({ value: store[(e as { key: string }).key] }))
  on('store.set', (_, e) => { const x = e as { key: string; value: unknown }; store[x.key] = x.value; return { value: undefined } })
  on('store.delete', () => ({ value: undefined }))
  on('store.keys', () => ({ value: Object.keys(store) }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('env.get', () => ({ value: undefined }))
  on('fs.list', () => { throw new Error('none') })
  on('fs.read', () => { throw new Error('none') })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Read', file_path: '/x' })
  await $.tool.call({ tool: 'Bash', command: 'git commit -m x' })
  for (const surface of ['desktop', 'terminal', 'mobile', 'vscode'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /🐜/ }))?.text).toContain('🐜')
    if (surface !== 'terminal') expect(await ui.find({ type: 'Svg' })).toBeDefined()
    if (surface === 'mobile' || surface === 'desktop') {
      for (const k of ['report', 'log', 'dex', 'line', 'dash']) { await ui.press({ key: `tab-${k}` }); expect(await ui.find({ type: 'Text' })).toBeDefined() }
      await ui.press({ key: 'tab-dex' }); expect((await ui.find({ type: 'Text', text: /발견|Found/ }))).toBeDefined()
      await ui.press({ key: 'tab-line' }); expect((await ui.find({ type: 'Text', text: /세대|Generation/ }))).toBeDefined()
      await ui.press({ key: 'tab-dash' })
    }
    await ui.unmount()
  }
})

test('the band above the prompt and every command answer', async ($, on) => {
  const store: Record<string, unknown> = {}
  on('command.register', () => ({ value: { command: 'ant' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))
  on('store.get', (_, e) => ({ value: store[(e as { key: string }).key] }))
  on('store.set', (_, e) => { const x = e as { key: string; value: unknown }; store[x.key] = x.value; return { value: undefined } })
  on('store.delete', () => ({ value: undefined }))
  on('store.keys', () => ({ value: Object.keys(store) }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('env.get', () => ({ value: undefined }))
  on('fs.list', () => { throw new Error('none') })
  on('fs.read', () => { throw new Error('none') })
  on('fs.write', () => ({ value: undefined }))
  on('session.surfaces', () => ({ value: ['desktop'] }))
  on('ui.close', () => ({ value: undefined }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const surface of ['desktop', 'terminal', 'mobile'] as const) {
    const ui = await $.ui.mount({ plugin: 'ant-nest', component: 'AbovePrompt', surface, props: { hasSurvey: false } } as never)
    expect((await ui.find({ type: 'Text', text: /🐜/ }))?.text).toContain('🐜')
    await ui.unmount()
  }
  for (const args of ['', 'stats', 'dex', 'report', 'report last', 'species', 'gift', 'card', 'new atta', 'off', 'stats', 'on', 'hide', 'show', 'version', 'reset']) {
    const r = await $.command.run({ command: 'ant', args } as never)
    expect(JSON.stringify(r).length).toBeGreaterThan(10)
  }
  await $.command.run({ command: 'ant', args: 'off' } as never)
  expect(JSON.stringify(await $.command.run({ command: 'ant', args: 'stats' } as never))).toMatch(/꺼져|is off/)
  await $.command.run({ command: 'ant', args: 'on' } as never)
  expect(JSON.stringify(await $.command.run({ command: 'ant', args: 'stats' } as never))).not.toMatch(/꺼져 있|is off in/)
  const gift = await $.command.run({ command: 'ant', args: 'gift' } as never)
  const code = /ANT-[0-9A-Z-]+/.exec(JSON.stringify(gift))![0]
  const adopted = await $.command.run({ command: 'ant', args: `adopt ${code}` } as never)
  expect(JSON.stringify(adopted)).not.toContain('올바른 선물 코드가 아닙')
})
