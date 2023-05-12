import fs from 'fs';
import getTranspositions from './database/getTranspositions.js';
import Pool from 'pg';
import { createServer } from 'http';
import express from 'express';
import { parse } from 'csv-parse';
import readline from 'readline';

let transpositions = {};
let canonTable = {max: 0, 0: null};

fs.readFile('database/transpositions.json', 'utf8', (err, t) => {
    transpositions = JSON.parse(t);
})

fs.readFile('database/canon_table.json', 'utf8', (err, t) => {
    if (err) return console.log(`\tJSON Read Error:${err}`);
    canonTable = JSON.parse(t);
})

const pool = new Pool.Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: 'thechesslibrary',
    password: process.env.PGPASSWORD,
    port: 5432,
})

function sql_dump(sql_query, name = '') {
    pool.query(sql_query, (err, res) => {
        if (err) {
            json_dump(JSON.stringify({query: sql_query, err}), `database/errors/${name}.json`);
            console.log(err);
            setTimeout((e) => {throw e}, 1000, err);
        }
        console.log(`pushed query successfully (${sql_query.slice(0, 125).replace('\n',' ')}...) from ${name}`);
    });
};

function json_dump(data, filename) {
    fs.writeFile(filename,
        data,
        {encoding: 'utf8', flag: 'w'},
        (err) => {err ? console.log(`\tJSON Error: ${err}`) : null}
    )
}

function splitIntoChunks(array, chunkSize) {
    let chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}

function parseCsv(file) {
    let res = [];
    const parser = parse({delimiter: ','});
    parser.on('data', row => {
        res.push(row);
    });
    return new Promise((resolve, reject) => {
        fs.readFile(`database/data/${file}.csv`, 'utf8', (err, d) => {
            if (err) reject(err);
            parser.write(d);
            parser.end();
        });
        parser.on('end', () => {
            resolve(res.slice(1, res.length - 1));
        });
    });
}

function pushCsvToSql(file, pushToSql = true) {
    const gamesPromise = parseCsv(file);
    gamesPromise.then(gamesArray => {
        let query = '';
        splitIntoChunks(gamesArray, 1000).forEach((games, i) => {
            query = `INSERT INTO main ("Round", "Event", "Date", "White", "Black", "WhiteElo", "BlackElo", "WhiteTitle", "BlackTitle", "Moves", "Result", "Site", "Termination", "TimeControl", "Collection") VALUES `;
            games.forEach((row, j) => {
                row[0] = row[0].slice(0, 254);
                row[9] = row[9].slice(0, 2040);
                row[10] = row[10].slice(0, 7);
                row[7] = row[7].slice(0, 7).replace(/'/g, "") || '';
                row[8] = row[8].slice(0, 7).replace(/'/g, "") || '';
                row = row.map(x => x.replace(/'/g, "''") || '');
                row = row.map(x => x.replace(/’/g, "''") || '');
                // row = row.map(x => x.replace("'", "").replace("’", "''"));
                row = row.map(x => `'${x}'`);
                row[5] = row[5] === "''" ? 'NULL' : parseInt(row[5].slice(1, row[5].length - 1)) || 'NULL';
                row[6] = row[6] === "''" ? 'NULL' : parseInt(row[6].slice(1, row[6].length - 1)) || 'NULL';
                row.push(`(SELECT id FROM collections WHERE name = '${file}')`);
                query += `(${row.join(', ')}), `;
            })
            query = query.slice(0, query.length - 2) + ';';
            // console.log(query.length)
            pushToSql ? sql_dump(query, `${file} ${i}-${parseInt(gamesArray.length / 1000)}`) : null;
        });
    });
}

// for (let file of ['world_championships', 'candidates', 'world_cup', 'interzonals', 'lichess_broadcasts', 'olympiads', 'tcec', 'titled_arena', 'titled_tuesday', 'wijk', 'women'])

for (let file of ['titled_tuesday']) {
    sql_dump(
        `INSERT INTO collections ("name")
        SELECT '${file}'
        WHERE NOT EXISTS (SELECT 1 FROM collections WHERE "name" = '${file}');`
    )
    pushCsvToSql(file);
}