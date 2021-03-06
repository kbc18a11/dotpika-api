import { Response, Router } from 'express';
import Request from '../schemas/TemplatePixelArt';
import mysql from '../shared/mysql';
import Dot from '../types/Dot';
import PixelArt from '../types/PixelArt';
import multer from 'multer';
import path from 'path';

const router = Router();

const bodyParser = require('body-parser')
router.use(bodyParser.urlencoded({ extended: true }))
router.use(bodyParser.json())

const strage = multer.diskStorage({
  destination: path.join(__dirname + '/../', 'public'),
  // ファイル名を指定(オリジナルのファイル名を指定)
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}${file.originalname}`);
  }
})

// アップロードされるファイルの受け取り
const upload = multer({
  storage: strage
})

router.get('/', async (req: Request, res: Response) => {
  try {
    let len = await (await mysql()).query('SELECT COUNT(*) FROM template_pixel_art');
    const ids = await (await mysql()).query(`SELECT id FROM template_pixel_art ORDER BY id`);
    const names = await (await mysql()).query(`SELECT name FROM template_pixel_art ORDER BY id`);
    const images = await (await mysql()).query(`SELECT example_image FROM template_pixel_art ORDER BY id`)

    if (!Number(len[0]['COUNT(*)'])) {
      return res.status(404).json('テンプレートが存在しません');
    }

    len = [...Array(len[0]['COUNT(*)']).keys()];

    const pixelArts: PixelArt[] = new Array();

    for (let i = 0; i < len.length; i++) {
      const pixels = await (await mysql())
        .query(`SELECT x, y, red, green, blue FROM template_pixel_art LEFT JOIN dot ON template_pixel_art.id = dot.template_pixel_art_id WHERE template_pixel_art.id = ${ids[i]['id']} ORDER BY dot.x, dot.y`)
      const rows: Dot[][] = new Array();
      for (let j = 0; j < 32; j++) {
        rows.push(pixels.splice(0, 32))
      }

      const pixelArt: PixelArt = {
        id: ids[i]["id"],
        name: names[i]["name"],
        example_image: images[i]["example_image"],
        dots: rows
      }
      pixelArts.push(pixelArt);
    }

    return res.json(pixelArts);
  } catch (e) {
    console.error(e);
    return res.status(500).json('');
  } finally {
    //切断処理
    await (await mysql()).end();
  }
});

router.post('/save', upload.single('example_image'), async (req: Request, res: Response) => {
  // 文字列化されたドット情報をjson化
  const dotsData: Dot[][] = JSON.parse(req.body.Dots);

  console.log(req.file);

  try {
    const template_pixel_art = await (await mysql())
      .query(`INSERT INTO template_pixel_art (name, example_image) values ('${req.body.name}','http://localhost:5000/${req.file.filename}')`);

    if (dotsData) {
      let values: string[] = new Array();
      dotsData.forEach((row) => {
        row.forEach(async (dot) => {
          values.push(`(${template_pixel_art.insertId},${dot.x},${dot.y},'${dot.red}','${dot.green}','${dot.blue}')`)
        });
      });

      const result = await (await mysql()).query(`INSERT INTO dot (template_pixel_art_id, x, y, red, green, blue) values ${values.join()}`);
      console.log(result);

      return res.json(result);
    }

    return res.json(template_pixel_art);
  } catch (e) {
    console.error(e);

    return res.status(500).json(e);
  } finally {
    await (await mysql()).end();
  }
});

export default router;
