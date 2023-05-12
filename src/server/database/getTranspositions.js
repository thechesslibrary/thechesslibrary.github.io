function getTranspositions(transpositionsDatabase, moves, aliases = null, transpositions = null, visited = null, currMoveLength = null) {
    if (!aliases && !transpositions && !visited && !currMoveLength) {
        aliases = [moves];
        transpositions = new Set();
        transpositions.add(moves);
        visited = new Set();
        currMoveLength = moves.length + 4;
    }
    let remLength = aliases.length
    for (let a = 0; a < remLength; a++) {
        let alias = aliases[a];
        const alias_full = [...transpositions].filter(x => x.startsWith(alias)).at(0);
        if (alias.length == moves.length && !transpositions.has(alias)) transpositions.add(alias);
        while (aliases[a].length > currMoveLength && alias.length > 8) {
            if (!visited.has(aliases[a])) {
                let temp = transpositionsDatabase[aliases[a].length].reduce((acc, curr) => { if (curr.includes(aliases[a])) acc.push(...curr.filter(x => !aliases.includes(x))); return acc; }, []);
                // temp = temp.filter(x => !!database.lookup.get(Math.min(x.length, Math.max(Object.keys(database.lookup)))).get(x.slice(0, Object.keys(database.lookup))));
                temp = temp.map(x => x + alias_full.slice(x.length))
                temp = temp.filter(x => !transpositions.has(x))
                visited.add(aliases[a]);
                aliases = aliases.concat(...temp.filter(x => !aliases.includes(x)));
                temp.forEach(x => transpositions.add(x));
            }
            aliases[a] = aliases[a].slice(0, aliases[a].length - 4)
        }
    }
    if (aliases.filter(x => x.length > currMoveLength).length == 0) {
        currMoveLength -= 4;
    }
    if (aliases.reduce((acc, curr) => acc.length > curr.length ? acc : curr, aliases[0]).length > 8) {
        return getTranspositions(transpositionsDatabase, moves, aliases, transpositions, visited, currMoveLength);
    } else {
        return transpositions;
    }
}

export default getTranspositions;