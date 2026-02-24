// Block creation of .md/.txt files outside of .claude/ directory
// Allows: README.md, CLAUDE.md, AGENTS.md, CONTRIBUTING.md, and anything inside .claude/
let d = '';
process.stdin.on('data', c => d += c);
process.stdin.on('end', () => {
  try {
    const i = JSON.parse(d);
    const p = (i.tool_input?.file_path || '').replace(/\\/g, '/');
    const isDocFile = /\.(md|txt)$/.test(p);
    const isAllowedName = /(README|CLAUDE|AGENTS|CONTRIBUTING|TODO)\.md$/.test(p);
    const isInsideClaude = /\/\.claude\//.test(p) || /\\\.claude\\/.test(i.tool_input?.file_path || '');

    if (isDocFile && !isAllowedName && !isInsideClaude) {
      console.error('[Hook] BLOCKED: Unnecessary documentation file creation');
      console.error('[Hook] File: ' + p);
      console.error('[Hook] Use README.md for documentation instead');
      process.exit(2);
    }
  } catch {}
  console.log(d);
});
