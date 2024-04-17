export default function createContext(path: string) {
    return {
        path: path.charCodeAt(path.length - 1) === 42 ? path.slice(0, -1) + '1/2/3/4/5/6/7/8/9' : path,
        params: null
    }
}
