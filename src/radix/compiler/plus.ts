export default function plus(num: string, val: number): string {
    if (val === 0) return num;

    const plusIdx = num.indexOf('+');
    return plusIdx === -1
        ? Number.isNaN(+num)
            ? `${num}+${val.toString()}`
            : (+num + val).toString()
        : `${num.substring(0, plusIdx)}+${+(num.substring(plusIdx + 1)) + val}`;
}


