package vfs

import (
	"crypto/rand"
	"fmt"
	"log"
	"os"
	"path"

	"github.com/dgraph-io/badger/v4"
)

// BadgerConfig Badger DB의 설정을 정의합니다.
type BadgerConfig struct {
	Path       string `json:"path" yaml:"path"`
	CacheSize  int64  `json:"cacheSize" yaml:"cacheSize"`
	EncryptKey []byte `json:"encryptKey" yaml:"encryptKey"`
	InMemory   bool   `json:"in-memory" yaml:"in-memory"`
}

var defaultConfig = BadgerConfig{
	Path:      "./storage",
	CacheSize: 100,
}

func (cfg BadgerConfig) options() badger.Options {
	if cfg.Path == "" {
		cfg.Path = defaultConfig.Path
	}
	if cfg.CacheSize == 0 {
		cfg.CacheSize = defaultConfig.CacheSize
	}
	if cfg.EncryptKey == nil {
		var encryptKey []byte
		var err error
		if cfg.InMemory {
			encryptKey, err = randomSecretKey()
			if err != nil {
				log.Panic(err)
			}
		} else {
			encryptKey, err = generateEncryptionKey(cfg.Path)
			if err != nil {
				log.Panic(err)
			}
		}
		cfg.EncryptKey = encryptKey
	}

	return badger.DefaultOptions(cfg.Path).
		WithInMemory(cfg.InMemory).
		WithEncryptionKey(cfg.EncryptKey).
		WithIndexCacheSize(cfg.CacheSize << 20)
}

func randomSecretKey() ([]byte, error) {
	key := make([]byte, 32) // AES-256에 필요한 32바이트 키
	_, err := rand.Read(key)
	return key, err
}

// generateEncryptionKey 32바이트(256비트)의 랜덤 암호화 키를 생성합니다.
func generateEncryptionKey(secretPath string) ([]byte, error) {
	secretFile := path.Join(secretPath, ".secret")
	if _, err := os.Stat(secretFile); err == nil {
		key, err := os.ReadFile(secretFile)
		if err == nil {
			return key, nil
		}
	}

	key, err := randomSecretKey()
	if err != nil {
		return nil, fmt.Errorf("failed generating encrypt ley: %w", err)
	}

	err = os.MkdirAll(secretPath, 0755)
	if err != nil {
		return nil, fmt.Errorf("error mkdirAll(%s) %v", secretPath, err)
	}

	err = os.WriteFile(secretFile, key, 0644)
	if err != nil {
		return nil, err
	}

	return key, nil
}
