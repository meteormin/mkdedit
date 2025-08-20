// WASM 로드
async function loadWasm() {
  const go = new Go();
  const resp = await fetch('main.wasm');
  const bytes = await resp.arrayBuffer();
  const { instance } = await WebAssembly.instantiate(bytes, go.importObject);
  go.run(instance);

  // wasm 실행 후 GoAPI가 전역에 등록됨
  // 여기서 vfs를 GoAPI.vfs에 연결
  vfs = {
    list() { return GoAPI.vfs.list(); },
    read(name) { return GoAPI.vfs.read(name); },
    write(name, content) { GoAPI.vfs.write(name, content); },
    exists(name) { return GoAPI.vfs.exists(name); }
  };

  // 초기화 진행
  initEditor();
  renderFiles('');
}

// VFS: WASM 실행 전까지는 빈 껍데기
let vfs = {
  list() { return []; },
  read(_) { return ''; },
  write(_, __) {},
  exists(_) { return false; }
};

// UI refs
const fileListEl = document.getElementById('fileList');
const newFileBtn = document.getElementById('newFileBtn');
const termOut = document.getElementById('term-output');
const termIn = document.getElementById('term-input');

// OverType 초기화
let currentFile = '';
let editorInstance;
function initEditor() {
  const [ed] = OverType.init('#editor', {
    toolbar: true,
    theme: 'cave',
    value: '# Welcome\n\n새 문서를 만들거나 파일을 선택하세요.',
    onChange: (val) => {
      if (currentFile) vfs.write(currentFile, val);
    }
  });
  editorInstance = ed;
}

function renderFiles(active) {
  fileListEl.innerHTML = '';
  vfs.list().forEach(name => {
    const li = document.createElement('li');
    li.textContent = name;
    if (name === active) li.classList.add('active');
    li.onclick = () => openFile(name);
    fileListEl.appendChild(li);
  });
}

function openFile(name) {
  currentFile = name;
  const content = vfs.read(name);
  editorInstance.setValue(content);
  renderFiles(name);
  log(`Opened: ${name}`);
}

function newFile() {
  let base = 'untitled.md', i = 1, name = base;
  while (vfs.exists(name)) { name = `untitled-${i++}.md`; }
  vfs.write(name, '# New Document');
  renderFiles(name);
  openFile(name);
}

function log(msg) {
    termOut.innerHTML += msg + "<br/>";
    termOut.scrollTop = termOut.scrollHeight;
}

function runTerminal(cmdline) {
  const [cmd, ...args] = cmdline.trim().split(/\s+/);
  switch (cmd) {
    case 'help':
      log('Commands: help, ls, open <file>, save, cat <file>'); break;
    case 'ls':
      vfs.list().forEach(f => log(f)); break;
    case 'open':
      if (!args[0]) return log('usage: open <file>');
      if (!vfs.exists(args[0])) return log('no such file');
      openFile(args[0]); break;
    case 'save':
      if (!currentFile) return log('no file');
      vfs.write(currentFile, editorInstance.getValue());
      log(`saved: ${currentFile}`); break;
    case 'cat':
      if (!args[0]) return log('usage: cat <file>');
      log(vfs.read(args[0])); break;
    default:
      if (cmd) log(`unknown: ${cmd}`);
  }
}

// 이벤트 바인딩
newFileBtn.onclick = newFile;
termIn.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    log('> ' + termIn.value);
    runTerminal(termIn.value);
    termIn.value = '';
  }
});

// 부트
loadWasm().catch(err => log('WASM load error: ' + err));
