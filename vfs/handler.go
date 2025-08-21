package vfs

import (
	"encoding/json"
	"net/http"
	"slices"

	"github.com/dgraph-io/badger/v4"
)

type VFS struct {
	db *badger.DB
}

func (vfs *VFS) ServeHTTP(res http.ResponseWriter, req *http.Request) {
	switch req.Method {
	case http.MethodGet:
		vfs.routeGET(res, req)
	case http.MethodPost:
		vfs.write(res, req)
	case http.MethodPut:
		vfs.rename(res, req)
	case http.MethodDelete:
		vfs.delete(res, req)
	}
}

func (vfs *VFS) routeGET(res http.ResponseWriter, req *http.Request) {
	q := req.URL.Query()
	switch q.Get("cmd") {
	case "list":
		vfs.list(res, req)
	case "read":
		vfs.read(res, req, q.Get("name"))
	case "exists":
		vfs.exists(res, req, q.Get("name"))
	}
}

func (vfs *VFS) list(res http.ResponseWriter, _ *http.Request) {
	keys, err := GetAllKeys(vfs.db)
	if err != nil {
		res.WriteHeader(http.StatusInternalServerError)
		return
	}

	res.Header().Set("Content-Type", "application/json")
	res.WriteHeader(http.StatusOK)

	if err = json.NewEncoder(res).Encode(map[string]any{
		"list": keys,
	}); err != nil {
		res.WriteHeader(http.StatusInternalServerError)
	}
}

func (vfs *VFS) read(res http.ResponseWriter, _ *http.Request, name string) {
	if name == "" {
		res.WriteHeader(http.StatusBadRequest)
		return
	}

	keys, err := GetAllKeys(vfs.db)
	if err != nil {
		res.WriteHeader(http.StatusInternalServerError)
		return
	}

	if !slices.Contains(keys, name) {
		res.WriteHeader(http.StatusNotFound)
		return
	}

	read, err := GetFile(vfs.db, name)
	if err != nil {
		res.WriteHeader(http.StatusInternalServerError)
		return
	}

	res.Header().Set("Content-Type", "application/json")
	res.WriteHeader(http.StatusOK)
	if err = json.NewEncoder(res).Encode(map[string]any{
		"content": string(read),
	}); err != nil {
		res.WriteHeader(http.StatusInternalServerError)
	}
}

func (vfs *VFS) write(res http.ResponseWriter, req *http.Request) {
	var body struct {
		Name    string `json:"name"`
		Content string `json:"content"`
	}

	err := json.NewDecoder(req.Body).Decode(&body)
	if err != nil {
		res.WriteHeader(http.StatusInternalServerError)
		return
	}

	if body.Name == "" {
		res.WriteHeader(http.StatusBadRequest)
		return
	}

	err = PutFile(vfs.db, body.Name, []byte(body.Content))
	if err != nil {
		res.WriteHeader(http.StatusInternalServerError)
		return
	}

	res.Header().Set("Content-Type", "application/json")
	res.WriteHeader(http.StatusCreated)
}

func (vfs *VFS) exists(res http.ResponseWriter, _ *http.Request, name string) {
	keys, err := GetAllKeys(vfs.db)
	if err != nil {
		res.WriteHeader(http.StatusInternalServerError)
		return
	}

	if slices.Contains(keys, name) {
		res.WriteHeader(http.StatusOK)
	} else {
		res.WriteHeader(http.StatusNotFound)
	}
}

func (vfs *VFS) rename(res http.ResponseWriter, req *http.Request) {
	var body struct {
		Old string `json:"old"`
		New string `json:"new"`
	}

	err := json.NewDecoder(req.Body).Decode(&body)
	if err != nil {
		res.WriteHeader(http.StatusInternalServerError)
		return
	}

	if body.Old == "" {
		res.WriteHeader(http.StatusBadRequest)
		return
	}
	if body.New == "" {
		res.WriteHeader(http.StatusBadRequest)
		return
	}

	keys, err := GetAllKeys(vfs.db)
	if err != nil {
		res.WriteHeader(http.StatusInternalServerError)
		return
	}

	if !slices.Contains(keys, body.Old) {
		res.WriteHeader(http.StatusNotFound)
		return
	}

	err = RenameFile(vfs.db, body.Old, body.New)
	if err != nil {
		res.WriteHeader(http.StatusInternalServerError)
		return
	}

	res.Header().Set("Content-Type", "application/json")
	res.WriteHeader(http.StatusOK)
}

func (vfs *VFS) delete(res http.ResponseWriter, req *http.Request) {
	q := req.URL.Query()
	name := q.Get("name")

	if name == "" {
		res.WriteHeader(http.StatusBadRequest)
		return
	}

	keys, err := GetAllKeys(vfs.db)
	if err != nil {
		res.WriteHeader(http.StatusInternalServerError)
		return
	}

	if !slices.Contains(keys, name) {
		res.WriteHeader(http.StatusNotFound)
		return
	}

	err = DeleteFile(vfs.db, name)
	if err != nil {
		res.WriteHeader(http.StatusInternalServerError)
		return
	}

	err = DeleteFile(vfs.db, name)
	if err != nil {
		res.WriteHeader(http.StatusInternalServerError)
		return
	}

	res.Header().Set("Content-Type", "application/json")
	res.WriteHeader(http.StatusNoContent)
}

func NewVFS(db *badger.DB) http.Handler {
	return &VFS{db: db}
}
