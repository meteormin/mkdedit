import OverType from "https://unpkg.com/overtype/dist/overtype.esm.js";

// VFS
let vfs = {
    async list() {
        // Go 핸들러는 {"list": keys}를 반환하므로 body.data 대신 body.list를 사용합니다.
        const res = await fetch(`/vfs?cmd=list`);
        if (res.ok) {
            const body = await res.json();
            return body.list;
        } else {
            return [];
        }
    },

    async read(name) {
        // GET 요청과 'read' 명령, 'name' 쿼리 매개변수를 사용합니다.
        const res = await fetch(`/vfs?cmd=read&name=${encodeURIComponent(name)}`);
        if (res.ok) {
            const body = await res.json();
            return body.content;
        } else if (res.status === 404) {
            return null; // 파일이 없을 경우 null을 반환합니다.
        }
        throw new Error(`Failed to read file: ${res.status}`);
    },

    async write(name, content) {
        // POST 요청과 JSON 본문을 사용합니다.
        const res = await fetch(`/vfs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({name, content})
        });
        if (!res.ok) {
            throw new Error(`Failed to write file: ${res.status}`);
        }
    },

    async exists(name) {
        // GET 요청과 'exists' 명령, 'name' 쿼리 매개변수를 사용합니다.
        // Go 핸들러는 존재 여부에 따라 200 또는 404 상태 코드를 반환합니다.
        const res = await fetch(`/vfs?cmd=exists&name=${encodeURIComponent(name)}`);
        if (res.ok) {
            return true;
        } else if (res.status === 404) {
            return false;
        }
        throw new Error(`Failed to check file existence: ${res.status}`);
    },

    async rename(name, newName) {
        // PUT 요청과 JSON 본문을 사용합니다.
        const res = await fetch(`/vfs`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({old: name, new: newName})
        });
        if (!res.ok) {
            throw new Error(`Failed to rename file: ${res.status}`);
        }
    },

    async delete(name) {
        // DELETE 요청과 'name' 쿼리 매개변수를 사용합니다.
        const res = await fetch(`/vfs?name=${encodeURIComponent(name)}`, {
            method: 'DELETE'
        });
        if (!res.ok) {
            throw new Error(`Failed to delete file: ${res.status}`);
        }
    }
};

// UI refs
const fileListEl = document.getElementById('fileList');
const newFileBtn = document.getElementById('newFileBtn');
const saveFileBtn = document.getElementById('saveFileBtn');
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

async function openFile(name) {
    currentFile = name;
    const content = await vfs.read(name);
    editorInstance.setValue(content);
    renderFiles();
    log(`Opened: ${name}`);
}

async function renderFiles() {
    fileListEl.innerHTML = '';
    const fileList = await vfs.list();

    fileList.forEach(name => {
        const li = document.createElement('li');

        // 파일명 span
        const nameSpan = document.createElement('span');
        nameSpan.textContent = name;
        li.appendChild(nameSpan);

        // 🗑 삭제 버튼
        const deleteBtn = document.createElement('span');
        deleteBtn.textContent = ' 🗑️';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.onclick = async (e) => {
            e.stopPropagation();
            if (confirm(`'${name}' 파일을 삭제하시겠습니까?`)) {
                try {
                    await vfs.delete(name);
                    log(`Deleted: ${name}`);
                    if (currentFile === name) {
                        currentFile = '';
                        editorInstance.setValue('# New Document\n\n새 문서를 만들거나 파일을 선택하세요.');
                    }
                    renderFiles();
                } catch (e) {
                    log(`Delete failed: ${e.message}`);
                }
            }
        };

        // ✏ 수정 버튼
        const editBtn = document.createElement('span');
        editBtn.textContent = ' ✏️';
        editBtn.style.cursor = 'pointer';
        editBtn.onclick = (e) => {
            e.stopPropagation();

            const input = document.createElement('input');
            input.type = 'text';
            input.value = name;
            input.size = Math.max(10, name.length);

            li.replaceChild(input, nameSpan);
            input.focus();

            const finish = async (commit = true) => {
                if (commit) {
                    const newName = input.value.trim();
                    if (newName && newName !== name) {
                        try {
                            await vfs.rename(name, newName);
                            if (currentFile === name) currentFile = newName;
                            nameSpan.textContent = newName;
                            log(`Renamed ${name} -> ${newName}`);
                            name = newName; // 이후에도 일관성 유지
                        } catch (e) {
                            log(`Rename failed: ${e.message}`);
                        }
                    }
                }
                li.replaceChild(nameSpan, input); // 원래 span 복원
            };

            input.addEventListener('blur', () => finish(true), {once: true});
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') finish(true);
                if (e.key === 'Escape') finish(false);
            });
        };

        li.appendChild(editBtn);
        li.appendChild(deleteBtn);

        // 파일 열기
        li.onclick = () => openFile(name);

        fileListEl.appendChild(li);
    });
}

async function newFile() {
    let base = 'untitled.md', i = 1, name = base;
    while (await vfs.exists(name)) { // await로 비동기 호출을 기다립니다.
        name = `untitled-${i++}.md`;
    }
    await vfs.write(name, '# New Document');
    await renderFiles();
    openFile(name);
}

async function saveFile() {
    if (!currentFile) {
        log('no file to save');
        return;
    }
    try {
        await vfs.write(currentFile, editorInstance.getValue());
        log(`Saved: ${currentFile}`);
    } catch (e) {
        log(`Save failed: ${e.message}`);
    }
}

function log(msg) {
    termOut.innerHTML += msg + "<br/>";
    termOut.scrollTop = termOut.scrollHeight;
}

async function runTerminal(cmdline) {
    const [cmd, ...args] = cmdline.trim().split(/\s+/);
    switch (cmd) {
        case 'help':
            log('Commands: help, new <file>, ls, open <file>, save, cat <file>, rm <file>');
            break;
        case 'new':   // ✅ 추가
            let base = 'untitled.md', i = 1, name = base;
            while (await vfs.exists(name)) {
                name = `untitled-${i++}.md`;
            }
            await vfs.write(name, '# New Document');
            await renderFiles();
            openFile(name);
            log(`created new file: ${name}`);
            break;
        case 'ls':
            const files = await vfs.list();
            files.forEach(f => log(f));
            break;
        case 'open':
            if (!args[0]) return log('usage: open <file>');
            const fileExists = await vfs.exists(args[0]);
            if (!fileExists) return log('no such file');
            openFile(args[0]);
            break;
        case 'save':
            if (!currentFile) return log('no file');
            await vfs.write(currentFile, editorInstance.getValue());
            log(`saved: ${currentFile}`);
            break;
        case 'rename':
            if (args.length < 2) return log('usage: rename <old> <new>');
            if (!await vfs.exists(args[0])) return log(`no such file: ${args[0]}`);
            if (await vfs.exists(args[1])) return log(`already exists: ${args[1]}`);
            await vfs.rename(args[0], args[1]);
            if (currentFile === args[0]) currentFile = args[1];
            await renderFiles();
            log(`renamed ${args[0]} -> ${args[1]}`);
            break;
        case 'cat':
            if (!args[0]) return log('usage: cat <file>');
            const content = await vfs.read(args[0]);
            log(content);
            break;
        case 'rm': // 새로 추가된 부분
            if (!args[0]) return log('usage: rm <file>');
            try {
                const fileExists = await vfs.exists(args[0]);
                if (!fileExists) return log('no such file');

                await vfs.delete(args[0]);
                log(`deleted: ${args[0]}`);

                // 현재 열려 있는 파일이라면 에디터 초기화
                if (currentFile === args[0]) {
                    editorInstance.setValue('# New Document');
                    currentFile = '';
                }
                await renderFiles();
            } catch (e) {
                log(`delete failed: ${e.message}`);
            }
            break;
        default:
            if (cmd) log(`unknown: ${cmd}`);
    }
}

// 이벤트 바인딩
newFileBtn.onclick = newFile;
saveFileBtn.onclick = saveFile;
termIn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        log('> ' + termIn.value);
        runTerminal(termIn.value); // runTerminal은 Promise를 반환하지만, 여기서 기다릴 필요는 없습니다.
        termIn.value = '';
    }
});

// 초기화 진행
initEditor();
renderFiles();