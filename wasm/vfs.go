//go:build js && wasm

package main

import "syscall/js"

// vfs state (여기서는 단순 map으로 메모리 저장)
var vfs = make(map[string]string)

func vfsList(this js.Value, args []js.Value) any {
	files := js.Global().Get("Array").New()
	for name := range vfs {
		files.Call("push", name)
	}
	return files
}

func vfsRead(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return ""
	}
	name := args[0].String()
	if val, ok := vfs[name]; ok {
		return val
	}
	return ""
}

func vfsWrite(this js.Value, args []js.Value) any {
	if len(args) < 2 {
		return nil
	}
	name := args[0].String()
	content := args[1].String()
	vfs[name] = content
	return nil
}

func vfsExists(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return false
	}
	name := args[0].String()
	_, ok := vfs[name]
	return ok
}

func registerCallbacks(goapi js.Value) {
	vfsObj := js.Global().Get("Object").New()
	vfsObj.Set("list", js.FuncOf(vfsList))
	vfsObj.Set("read", js.FuncOf(vfsRead))
	vfsObj.Set("write", js.FuncOf(vfsWrite))
	vfsObj.Set("exists", js.FuncOf(vfsExists))

	goapi.Set("vfs", vfsObj)
}
