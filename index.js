const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { Command } = require('commander');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');


const program = new Command();
program
  .requiredOption('-h, --host <host>', 'server host')
  .requiredOption('-p, --port <port>', 'server port')
  .requiredOption('-c, --cache <path>', 'cache directory');
program.allowUnknownOption(false);

try {
  program.parse(process.argv);
} catch (err) {
  console.error(' Invalid command-line arguments');
  process.exit(1);
}

const { host, port, cache } = program.opts();
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (!fs.existsSync(cache)) {
  try {
    fs.mkdirSync(cache, { recursive: true });
    console.log(` Created cache directory: ${cache}`);
  } catch (err) {
    console.error(' Failed to create cache directory:', err.message);
    process.exit(1);
  }
}

// Multer для multipart/form-data
const storage = multer.memoryStorage();
const upload = multer({ storage });

/**
 * @swagger
 * /UploadForm.html:
 *   get:
 *     summary: Повертає HTML-форму для завантаження нотатки
 *     responses:
 *       200:
 *         description: HTML-сторінка з формою
 */
app.get('/UploadForm.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'UploadForm.html'));
});

/**
 * @swagger
 * /write:
 *   post:
 *     summary: Створити нову нотатку
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               note_name:
 *                 type: string
 *               note:
 *                 type: string
 *     responses:
 *       201:
 *         description: Нотатку створено
 *       400:
 *         description: Нотатка вже існує
 */
app.post('/write', upload.none(), (req, res) => {
  const { note_name, note } = req.body;
  const filePath = path.join(cache, note_name + '.txt');
  if (fs.existsSync(filePath)) return res.status(400).send('Note already exists');
  fs.writeFileSync(filePath, note);
  res.status(201).send('Note created');
});

/**
 * @swagger
 * /notes/{name}:
 *   get:
 *     summary: Отримати нотатку за назвою
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Текст нотатки
 *       404:
 *         description: Нотатку не знайдено
 */
app.get('/notes/:name', (req, res) => {
  const filePath = path.join(cache, req.params.name + '.txt');
  if (!fs.existsSync(filePath)) return res.sendStatus(404);
  res.send(fs.readFileSync(filePath, 'utf-8'));
});

/**
 * @swagger
 * /notes/{name}:
 *   put:
 *     summary: Оновити нотатку
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         text/plain:
 *           schema:
 *             type: string
 *     responses:
 *       200:
 *         description: Оновлено
 *       404:
 *         description: Нотатку не знайдено
 */
app.put('/notes/:name', express.text(), (req, res) => {
  const filePath = path.join(cache, req.params.name + '.txt');
  if (!fs.existsSync(filePath)) return res.sendStatus(404);
  fs.writeFileSync(filePath, req.body);
  res.send('Note updated');
});

/**
 * @swagger
 * /notes/{name}:
 *   delete:
 *     summary: Видалити нотатку
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Видалено
 *       404:
 *         description: Нотатку не знайдено
 */
app.delete('/notes/:name', (req, res) => {
  const filePath = path.join(cache, req.params.name + '.txt');
  if (!fs.existsSync(filePath)) return res.sendStatus(404);
  fs.unlinkSync(filePath);
  res.send('Note deleted');
});

/**
 * @swagger
 * /notes:
 *   get:
 *     summary: Отримати список усіх нотаток
 *     responses:
 *       200:
 *         description: Список нотаток
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   text:
 *                     type: string
 */
app.get('/notes', (req, res) => {
  try {
    const files = fs.readdirSync(cache);
    const notes = [];

    for (const file of files) {
      const filePath = path.join(cache, file);
      if (
        fs.lstatSync(filePath).isFile() &&
        !file.startsWith('.') &&
        !file.startsWith('_')
      ) {
        const name = path.parse(file).name;
        const text = fs.readFileSync(filePath, 'utf-8');
        notes.push({ name, text });
      }
    }

    res.json(notes);
  } catch (err) {
    console.error(' Error reading notes directory:', err.message);
    res.status(500).send('Internal Server Error');
  }
});

// Swagger документація
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Notes API',
      version: '1.0.0',
      description: 'Документація для лабораторної №6',
    },
  },
  apis: [__filename],
});
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Запуск сервера
app.listen(port, host, () => {
  console.log(` Server running at http://${host}:${port}`);
  console.log(` Swagger доступний на http://${host}:${port}/docs`);
});
