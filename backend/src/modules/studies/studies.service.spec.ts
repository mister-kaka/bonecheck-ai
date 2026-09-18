// import { StudyStatus } from './study.types';
// import { StudiesService } from './studies.service';

// const file = {
//   originalname: 'spine.dcm',
//   mimetype: 'application/dicom',
//   size: 8,
//   buffer: Buffer.from('dicomimg'),
// };

// function createService(analyze?: () => Promise<unknown>) {
//   const store = new Map<string, { id: string }>();
//   const studies = {
//     save: jest.fn(async (study: { id: string }) => {
//       store.set(study.id, study);
//       return study;
//     }),
//     findById: jest.fn(async (id: string) => store.get(id) ?? null),
//   };
//   const mlClient = {
//     analyze: jest.fn(
//       analyze ??
//         (async () => ({
//           quality_class: 0,
//           violation_type: '',
//           quality_prob: 0.1,
//         })),
//     ),
//   };
//   const fileStorage = {
//     save: jest.fn(async () => '/tmp/uploads/spine.dcm'),
//   };

//   const service = new StudiesService(studies as never, mlClient as never, fileStorage as never);
//   return { service, mlClient, fileStorage };
// }

// async function waitForStatus(service: StudiesService, id: string, status: StudyStatus) {
//   for (let i = 0; i < 30; i += 1) {
//     const current = await service.getById(id);
//     if (current.status === status) {
//       return current;
//     }
//     await new Promise((resolve) => setTimeout(resolve, 10));
//   }

//   throw new Error(`status ${status} not reached`);
// }

// describe('StudiesService', () => {
//   it('rejects missing file', async () => {
//     const { service } = createService();
//     await expect(service.create(undefined)).rejects.toMatchObject({
//       response: { code: 'FILE_REQUIRED' },
//     });
//   });

//   it('rejects empty file', async () => {
//     const { service } = createService();
//     await expect(
//       service.create({
//         ...file,
//         size: 0,
//         buffer: Buffer.alloc(0),
//       }),
//     ).rejects.toMatchObject({
//       response: { code: 'FILE_REQUIRED' },
//     });
//   });

//   it('rejects invalid file type', async () => {
//     const { service } = createService();
//     await expect(
//       service.create({
//         ...file,
//         originalname: 'photo.png',
//         mimetype: 'image/png',
//       }),
//     ).rejects.toMatchObject({
//       response: { code: 'INVALID_FILE_TYPE' },
//     });
//   });

//   it('creates a study, runs mock analysis and returns result', async () => {
//     const { service, mlClient, fileStorage } = createService();
//     const created = await service.create(file);

//     expect(created.status).toBe(StudyStatus.Processing);
//     expect(created.id).toEqual(expect.any(String));
//     expect(fileStorage.save).toHaveBeenCalled();

//     await waitForStatus(service, created.id, StudyStatus.Completed);

//     const status = await service.getById(created.id);
//     expect(status.hasResult).toBe(true);
//     expect(mlClient.analyze).toHaveBeenCalledWith({
//       studyId: created.id,
//       filePath: '/tmp/uploads/spine.dcm',
//       originalFileName: 'spine.dcm',
//     });

//     const result = await service.getResult(created.id);
//     expect(result.quality_class).toBe(0);
//     expect(result.violation_type).toBe('');
//     expect(result.studyId).toBe(created.id);
//   });

//   it('returns RESULT_NOT_READY while analysis is still running', async () => {
//     let release!: () => void;
//     const gate = new Promise<void>((resolve) => {
//       release = resolve;
//     });

//     const { service } = createService(async () => {
//       await gate;
//       return { quality_class: 0, violation_type: '' };
//     });

//     const created = await service.create(file);
//     await expect(service.getResult(created.id)).rejects.toMatchObject({
//       response: { code: 'RESULT_NOT_READY', status: StudyStatus.Processing },
//     });

//     release();
//     await waitForStatus(service, created.id, StudyStatus.Completed);
//   });

//   it('marks study as error when ML fails', async () => {
//     const { service } = createService(async () => {
//       throw new Error('ml down');
//     });
//     const created = await service.create(file);
//     const status = await waitForStatus(service, created.id, StudyStatus.Error);

//     expect(status.error).toBe('Ошибка обработки ML.');
//     expect(status.hasResult).toBe(false);
//     await expect(service.getResult(created.id)).rejects.toMatchObject({
//       response: { code: 'ANALYSIS_FAILED' },
//     });
//   });

//   it('returns not found for unknown study', async () => {
//     const { service } = createService();
//     const id = '3b2a1c90-7d4e-4f1a-9c2b-8e6d5f4a3b21';
//     await expect(service.getById(id)).rejects.toMatchObject({
//       response: { code: 'STUDY_NOT_FOUND' },
//     });
//     await expect(service.getResult(id)).rejects.toMatchObject({
//       response: { code: 'STUDY_NOT_FOUND' },
//     });
//   });
// });
