# Go WASM + OverType Markdown Editor (IDE 레이아웃 샘플)

아래는 **IDE 스타일 레이아웃(사이드바:에디터=2:8, 터미널:메인프레임=2:8)**로 동작하는 최소 구현 예시입니다. 파일 탐색기/터미널은 브라우저 LocalStorage 기반의 간단한 가상 파일시스템을 사용합니다. 에디터는 **OverType**(투명 `<textarea>` + 렌더)로 Markdown을 입력/미리보기 합니다.

> 실행 방법 요약
>
> 1) Go 1.22+ 설치 → `GOOS=js GOARCH=wasm go build -o web/main.wasm ./wasm`
> 2) 로컬 서버로 `web/` 서빙 (예: `go run ./serve` 또는 `python -m http.server`)
> 3) 브라우저로 `http://localhost:8000` 접속

---

## 1) 디렉터리 구조
```
project/
├─ web/
│  ├─ index.html
│  ├─ style.css
│  ├─ main.js
│  └─ main.wasm        # GOOS=js GOARCH=wasm 빌드 산출물
├─ wasm/
│  └─ main.go          # 브라우저에서 실행될 Go(WASM)
└─ serve/
   └─ main.go          # (선택) 간단한 정적 서버
```

---

## 2) `web/index.html`

```html
<!doctype html>
<html lang="ko">
<head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>Go WASM + OverType Markdown IDE</title>
    <link rel="stylesheet" href="style.css"/>
    <!-- OverType: CDN 단일 스크립트 -->
    <script src="https://unpkg.com/overtype/dist/overtype.min.js"></script>
</head>
<body>
<div id="root" class="layout">
    <!-- 메인 프레임 (상단 80%) -->
    <section class="mainframe">
        <aside id="sidebar" class="sidebar">
            <header>
                <h3>Files</h3>
                <button id="newFileBtn">+ New</button>
            </header>
            <ul id="fileList" class="file-list"></ul>
        </aside>
        <main class="editor">
            <div id="toolbar" class="toolbar"></div>
            <div id="editor" class="editor-host"></div>
        </main>
    </section>

    <!-- 터미널 (하단 20%) -->
    <section class="terminal">
        <div id="term-output" class="term-output"></div>
        <div class="term-input">
            <label>>> </label>
            <input id="term-input" placeholder="help, ls, open <file>, save, cat <file> ..."/>
        </div>
    </section>
</div>

<!-- Go WASM 런타임 -->
<script src="https://go.dev/dl/go1.22.5.linux-amd64.tar.gz" async defer onload=""></script>
<script src="/ui/wasm_exec.js"></script>
<script src="main.js" type="module"></script>
</body>
</html>
```

> **주의:** `wasm_exec.js`는 Go 설치 경로(`$(go env GOROOT)/misc/wasm/wasm_exec.js`)에서 `web/`로 복사해두세요.

---

## 3) `web/style.css`
```css
/* 전체 레이아웃: 세로 2행 그리드 (메인프레임:터미널 = 8:2) */
html, body { height: 100%; margin: 0; }
#root.layout {
  height: 100vh;
  display: grid;
  grid-template-rows: 8fr 2fr; /* 80% : 20% */
}

/* 메인프레임: 가로 2열 (사이드바:에디터 = 2:8) */
.mainframe {
  display: grid;
  grid-template-columns: 2fr 8fr; /* 20% : 80% */
  overflow: hidden;
}

.sidebar {
  border-right: 1px solid #333;
  display: flex;
  flex-direction: column;
}
.sidebar header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 10px; border-bottom: 1px solid #333;
}
.file-list { list-style: none; padding: 0; margin: 0; overflow: auto; }
.file-list li { padding: 8px 10px; cursor: pointer; border-bottom: 1px dotted #444; }
.file-list li.active { background: #1f2937; }

.editor { display: flex; flex-direction: column; overflow: hidden; }
.toolbar { padding: 6px 8px; border-bottom: 1px solid #333; }
.editor-host { flex: 1; min-height: 0; }
.editor-host > div { height: 100%; }

/* OverType 에디터 영역 크기 지정 */
#editor { height: 100%; }

/* 터미널 */
.terminal { border-top: 1px solid #333; display: flex; flex-direction: column; }
.term-output { flex: 1; overflow: auto; padding: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.term-input { display: flex; gap: 6px; padding: 6px 8px; border-top: 1px solid #333; }
.term-input input { flex: 1; }

/* 다크톤 기본 */
body { color: #e5e7eb; background: #0b1020; }
button { cursor: pointer; }
```

---

## 4) `web/main.js`
```js
import { initFS } from './vfs.js'; // (선택) 분리 가능. 여기선 인라인로 작성해도 OK.

// WASM 로드
async function loadWasm() {
  const go = new Go();
  const resp = await fetch('main.wasm');
  const bytes = await resp.arrayBuffer();
  const { instance } = await WebAssembly.instantiate(bytes, go.importObject);
  go.run(instance);
}

// 간단한 VFS(LocalStorage)
const VFS_PREFIX = 'mdfs:';
const vfs = {
  list() { return Object.keys(localStorage).filter(k => k.startsWith(VFS_PREFIX)).map(k => k.slice(VFS_PREFIX.length)); },
  read(name) { return localStorage.getItem(VFS_PREFIX+name) ?? ''; },
  write(name, content) { localStorage.setItem(VFS_PREFIX+name, content); },
  exists(name) { return localStorage.getItem(VFS_PREFIX+name) !== null; }
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

function log(msg) { termOut.innerHTML += msg + "\n"; termOut.scrollTop = termOut.scrollHeight; }

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
initEditor();
renderFiles('');
loadWasm().catch(err => log('WASM load error: ' + err));
```

> 참고: OverType API/사용 예시는 공식 README의 CDN/QuickStart를 그대로 따릅니다.

---

## 5) `wasm/main.go` (브라우저에서 실행)
```go
//go:build js && wasm

package main

import (
	"syscall/js"
)

// 예시: JS에서 window.GoAPI.hello() 호출 시 문자열 반환
func hello(this js.Value, args []js.Value) any {
	return js.ValueOf("hello from Go WASM")
}

// 예시: 현재 에디터 값을 상단 바(타이틀)로 띄우는 등의 훅을 만들 수 있음
func onSave(this js.Value, args []js.Value) any {
	// args[0] = fileName, args[1] = content
	// 여기서는 데모로 console.log로만 출력
	js.Global().Get("console").Call("log", "[Go] save:", args[0], len(args[1].String()))
	return nil
}

func main() {
	goapi := js.Global().Get("Object").New()
	goapi.Set("hello", js.FuncOf(hello))
	goapi.Set("onSave", js.FuncOf(onSave))
	js.Global().Set("GoAPI", goapi)

	select {} // keep running
}
```

---

## 6) (선택) `serve/main.go` – 정적 서버
```go
package main

import (
	"log"
	"net/http"
)

func main() {
	fs := http.FileServer(http.Dir("web"))
	http.Handle("/", fs)
	log.Println("listening on :8000")
	log.Fatal(http.ListenAndServe(":8000", nil))
}
```

---

## 7) 빌드 & 실행
```bash
# 1) WASM 실행파일 빌드
GOOS=js GOARCH=wasm go build -o web/main.wasm ./wasm

# 2) wasm_exec.js 복사 (처음 1회)
cp "$(go env GOROOT)/misc/wasm/wasm_exec.js" web/

# 3) 웹 서버 실행
go run ./serve
# → http://localhost:8000 접속
```

---

## 8) 확장 아이디어
- 파일탐색기: File System Access API(크롬/엣지)로 로컬 파일 열기/저장 지원
- 터미널: `help`, `grep`, `find`, `mv`, `rm` 등 추가 + history, 키바인딩
- Markdown 내보내기: `.md` 다운로드, HTML Export
- 테마: OverType `theme: 'solar' | 'cave'` 토글
- 다중 탭: 편집기 상단에 탭바 추가

---

## 참고
- OverType 공식: CDN/QuickStart, API, 테마 등 README 문서
- Fyne WASM은 가능하나(브라우저에서 실행) 텍스트/클립보드/파일 I/O 제약 이슈가 있으니, 본 예시는 **HTML+JS+OverType + Go(WASM)**의 혼합으로 간결하게 구성했습니다.
```
CDN: <script src="https://unpkg.com/overtype/dist/overtype.min.js"></script>
```

