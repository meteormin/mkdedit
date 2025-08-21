// VFS
let vfs = {
    list() {
        return [];
    },
    read(name) {
        return '';
    },
    write(name, content) {
    },
    exists(name) {
        return false;
    },
    rename(name, newName) {
        return false;
    },
    delete(name) {
        return false;
    }
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

        // ✅ 더블클릭 → 이름 수정 모드
        li.ondblclick = () => {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = name;
            input.size = Math.max(10, name.length);

            li.replaceWith(input);
            input.focus();

            const finish = () => {
                const newName = input.value.trim();
                if (newName && newName !== name) {
                    try {
                        vfs.rename(name, newName);
                        if (currentFile === name) currentFile = newName;
                        renderFiles(currentFile);
                        log(`renamed ${name} -> ${newName}`);
                    } catch (e) {
                        log(`rename failed: ${e.message}`);
                        renderFiles(currentFile);
                    }
                } else {
                    renderFiles(currentFile); // 취소
                }
            };

            input.addEventListener('blur', finish);
            input.addEventListener('keydown', e => {
                if (e.key === 'Enter') finish();
                if (e.key === 'Escape') renderFiles(currentFile);
            });
        };

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
    while (vfs.exists(name)) {
        name = `untitled-${i++}.md`;
    }
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
            log('Commands: help, ls, open <file>, save, cat <file>');
            break;
        case 'ls':
            vfs.list().forEach(f => log(f));
            break;
        case 'open':
            if (!args[0]) return log('usage: open <file>');
            if (!vfs.exists(args[0])) return log('no such file');
            openFile(args[0]);
            break;
        case 'save':
            if (!currentFile) return log('no file');
            vfs.write(currentFile, editorInstance.getValue());
            log(`saved: ${currentFile}`);
            break;
        case 'rename':
            if (args.length < 2) return log('usage: rename <old> <new>');
            if (!vfs.exists(args[0])) return log(`no such file: ${args[0]}`);
            if (vfs.exists(args[1])) return log(`already exists: ${args[1]}`);
            vfs.rename(args[0], args[1]);
            if (currentFile === args[0]) currentFile = args[1];
            renderFiles(currentFile);
            log(`renamed ${args[0]} -> ${args[1]}`);
            break;
        case 'cat':
            if (!args[0]) return log('usage: cat <file>');
            log(vfs.read(args[0]));
            break;
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

// 초기화 진행
initEditor();
renderFiles('');