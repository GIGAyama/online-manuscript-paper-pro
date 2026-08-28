/** Tailwind の設定。使うクラスだけを先に作るため、原本を content に並べる。
 *  cdn.tailwindcss.com（ブラウザ内で CSS を生成する版）は使わない。 */
module.exports = Object.assign({ content: ["./src/**/*.jsx", "./index.html", "./offline.html"] }, {
        theme: {
            extend: {
                colors: {
                    student: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8' },
                    teacher: { 50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c' },
                    paper: '#fdfbf7',
                    genkoLine: 'rgba(46, 125, 50, 0.4)',
                    genkoStrong: 'rgba(46, 125, 50, 0.8)'
                },
                fontFamily: {
                    sans: ['"Zen Maru Gothic"', 'sans-serif'],
                    genko: ['"Shippori Mincho"', '"Zen Old Mincho"', 'serif'],
                    serif: ['"Shippori Mincho"', '"Zen Old Mincho"', 'serif'],
                },
                transitionProperty: {
                    'height': 'height',
                    'spacing': 'margin, padding',
                }
            }
        }
});
