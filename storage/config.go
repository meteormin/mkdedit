package storage

import "github.com/dgraph-io/badger/v4"

// BadgerConfig Badger DB의 설정을 정의합니다.
type BadgerConfig struct {
	Path       string `json:"path" yaml:"path"`
	CacheSize  int64  `json:"cacheSize" yaml:"cacheSize"`
	EncryptKey []byte `json:"encryptKey" yaml:"encryptKey"`
	InMemory   bool   `json:"in-memory" yaml:"in-memory"`
}

func (cfg BadgerConfig) options() badger.Options {
	return badger.DefaultOptions(cfg.Path).
		WithInMemory(cfg.InMemory).
		WithEncryptionKey(cfg.EncryptKey).
		WithIndexCacheSize(cfg.CacheSize << 20)
}
