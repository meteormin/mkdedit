package storage

import (
	"fmt"

	"github.com/dgraph-io/badger/v4"
)

// New Badger DB를 초기화합니다.
func New(cfg BadgerConfig) (*badger.DB, error) {
	return badger.Open(cfg.options())
}

// PutFile 지정한 로컬 파일의 내용을 읽어 key에 해당하는 값으로 Badger DB에 저장합니다.
func PutFile(db *badger.DB, key string, data []byte) error {
	// Badger 트랜잭션을 통해 데이터 저장
	err := db.Update(func(txn *badger.Txn) error {
		return txn.Set([]byte(key), data)
	})
	if err != nil {
		return fmt.Errorf("failed save badger: %w", err)
	}
	return nil
}

func GetAllKeys(db *badger.DB) ([]string, error) {
	var keys []string

	err := db.View(func(txn *badger.Txn) error {
		opts := badger.DefaultIteratorOptions
		opts.PrefetchValues = false

		it := txn.NewIterator(opts)
		defer it.Close()

		for it.Rewind(); it.Valid(); it.Next() {
			item := it.Item()
			k := item.Key()
			keys = append(keys, string(k))
		}
		return nil
	})

	if err != nil {
		return nil, err
	}
	return keys, nil
}

// GetFile Badger DB에서 지정된 key의 파일 바이너리를 가져옵니다.
func GetFile(db *badger.DB, key string) ([]byte, error) {
	var data []byte
	err := db.View(func(txn *badger.Txn) error {
		item, err := txn.Get([]byte(key))
		if err != nil {
			return fmt.Errorf("failed get [%s] key: %w", key, err)
		}
		data, err = item.ValueCopy(nil)
		return err
	})

	if err != nil {
		return nil, err
	}

	return data, nil
}

// DeleteFile Badger DB에서 지정된 key를 삭제합니다.
func DeleteFile(db *badger.DB, key string) error {
	err := db.Update(func(txn *badger.Txn) error {
		return txn.Delete([]byte(key))
	})
	if err != nil {
		return fmt.Errorf("키 [%s] 삭제 실패: %w", key, err)
	}
	return nil
}
