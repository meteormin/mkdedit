package main

import (
	"log"
	"net/http"

	"github.com/meteormin/mkdedit/vfs"
)

func main() {
	fs := http.FileServer(http.Dir("webui"))
	http.Handle("/", fs)

	db, err := vfs.NewDB(vfs.BadgerConfig{})
	if err != nil {
		log.Panic(err)
	}

	http.Handle("/vfs", vfs.NewVFS(db))

	log.Println("listening on :8000")
	log.Fatal(http.ListenAndServe(":8000", nil))
}
