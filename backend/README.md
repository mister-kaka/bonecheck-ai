# Backend

API BoneCheck AI. Принимает DICOM и ZIP, хранит исследования и отдаёт статус, результат и XLSX.

## Запуск

Из этой папки, нужен Node.js 20:

```bash
npm install
npm run start:dev
```

- API: http://localhost:3000
- проверка: http://localhost:3000/health
- описание методов: http://localhost:3000/api/docs

Полная инструкция: [запуск](../docs/system/running.md).

## Документация

- [API](../docs/system/api.md)
- [Архитектура](../docs/system/architecture.md)
- [Тесты](../docs/system/testing.md)
