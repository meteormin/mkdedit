package main

import (
	"log"
	"net/http"
)

func main() {
	fs := http.FileServer(http.Dir("ui"))
	http.Handle("/", fs)
	log.Println("listening on :8000")
	log.Fatal(http.ListenAndServe(":8000", nil))
}
