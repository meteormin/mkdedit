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
