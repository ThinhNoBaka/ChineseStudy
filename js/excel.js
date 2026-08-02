// excel.js
// Reads an uploaded .xlsx/.xls/.csv file and turns it into vocabulary
// grouped by lesson. Each SHEET in the workbook is treated as one lesson
// ("bài"), named after the sheet tab. Within every sheet: column A = Chinese,
// B = Pinyin, C = Vietnamese meaning. Header rows (if any) are skipped
// automatically — a row only counts if column A contains at least one CJK
// character.

const CJK_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf]/;

/**
 * Reads a File object and resolves to an array of lessons, one per sheet.
 * @param {File} file
 * @returns {Promise<Array<{name:string, rows:Array<{hanzi,pinyin,vi}>}>>}
 */
export function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file provided.'));
      return;
    }
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        const lessons = [];
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });

          const words = [];
          for (const row of rawRows) {
            if (!row || row.length === 0) continue;
            const hanziRaw = row[0] !== undefined ? String(row[0]).trim() : '';
            const pinyinRaw = row[1] !== undefined ? String(row[1]).trim() : '';
            const viRaw = row[2] !== undefined ? String(row[2]).trim() : '';

            if (!hanziRaw) continue;
            // Skip an obvious header row like "Chinese / Pinyin / Vietnamese".
            if (!CJK_REGEX.test(hanziRaw)) continue;

            words.push({ hanzi: hanziRaw, pinyin: pinyinRaw, vi: viRaw });
          }

          if (words.length > 0) {
            lessons.push({ name: sheetName, rows: words });
          }
        }

        if (lessons.length === 0) {
          reject(new Error('No valid vocabulary rows were found in this file.'));
          return;
        }

        resolve(lessons);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Flattens parsed lessons into a single word list with stable ids and
 * embedded lesson info, ready to store as a deck's vocabulary.
 * @param {Array<{name:string, rows:Array}>} lessons
 * @returns {Array<{id,hanzi,pinyin,vi,lessonId,lessonName}>}
 */
export function withIds(lessons) {
  const words = [];
  lessons.forEach((lesson, lessonIndex) => {
    const lessonId = `l${lessonIndex}`;
    lesson.rows.forEach((row, rowIndex) => {
      words.push({
        id: `w${lessonIndex}_${rowIndex}_${row.hanzi}`,
        lessonId,
        lessonName: lesson.name,
        ...row,
      });
    });
  });
  return words;
}

/**
 * Groups a flat word list back into an ordered list of lessons with counts.
 * Used to build the "choose a lesson" screen from a deck's stored vocab.
 * @param {Array<{lessonId,lessonName}>} vocab
 * @returns {Array<{id:string, name:string, count:number}>}
 */
export function deriveLessons(vocab) {
  const map = new Map();
  for (const w of vocab) {
    const id = w.lessonId || 'l0';
    const name = w.lessonName || 'Bài 1';
    if (!map.has(id)) map.set(id, { id, name, count: 0 });
    map.get(id).count += 1;
  }
  return Array.from(map.values());
}
