export default function plus(num: string, val: number): string {
    if (val === 0) return num;

    const slices = num.split('+'), left = +slices[0];

    let total = +slices[1];
    if (isNaN(total)) total = 0;

    return isNaN(left) ? `${slices[0]}+${val + total}` : (left + val).toString();
}


