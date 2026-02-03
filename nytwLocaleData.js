export const UNICODE_RANGES = {
    cjk: {
        label: '汉字 (Han/CJK)',
        ranges: [
            [0x3400, 0x4DBF], // CJK Unified Ideographs Extension A
            [0x4E00, 0x9FFF], // CJK Unified Ideographs
            [0xF900, 0xFAFF], // CJK Compatibility Ideographs
            [0x20000, 0x2A6DF], // Extension B
            [0x2A700, 0x2B73F], // Extension C
            [0x2B740, 0x2B81F], // Extension D
            [0x2B820, 0x2CEAF], // Extension E/F
            [0x2CEB0, 0x2EBEF], // Extension G
        ],
    },
    jp_kana: {
        label: '日文假名 (Kana)',
        ranges: [
            [0x3040, 0x309F], // Hiragana
            [0x30A0, 0x30FF], // Katakana
            [0x31F0, 0x31FF], // Katakana Phonetic Extensions
            [0xFF65, 0xFF9F], // Halfwidth Katakana
        ],
    },
    jp_hiragana: { label: '平假名 (Hiragana)', ranges: [[0x3040, 0x309F]] },
    jp_katakana: {
        label: '片假名 (Katakana)',
        ranges: [
            [0x30A0, 0x30FF],
            [0x31F0, 0x31FF],
            [0xFF65, 0xFF9F],
        ],
    },
    hangul: {
        label: '韩文 (Hangul)',
        ranges: [
            [0x1100, 0x11FF], // Hangul Jamo
            [0x3130, 0x318F], // Hangul Compatibility Jamo
            [0xA960, 0xA97F], // Hangul Jamo Extended-A
            [0xAC00, 0xD7AF], // Hangul Syllables
            [0xD7B0, 0xD7FF], // Hangul Jamo Extended-B
        ],
    },
    bopomofo: {
        label: '注音 (Bopomofo)',
        ranges: [
            [0x3100, 0x312F], // Bopomofo
            [0x31A0, 0x31BF], // Bopomofo Extended
        ],
    },
    latin: {
        label: '英文/西文 (Latin)',
        ranges: [
            [0x0000, 0x00FF], // Basic Latin + Latin-1 Supplement
            [0x0100, 0x024F], // Latin Extended-A/B
            [0x1E00, 0x1EFF], // Latin Extended Additional
        ],
    },
    cyrillic: { label: '西里尔 (Cyrillic)', ranges: [[0x0400, 0x052F]] },
    greek: { label: '希腊文 (Greek)', ranges: [[0x0370, 0x03FF]] },
    arabic: {
        label: '阿拉伯文 (Arabic)',
        ranges: [
            [0x0600, 0x06FF],
            [0x0750, 0x077F],
            [0x08A0, 0x08FF],
            [0xFB50, 0xFDFF], // Presentation Forms-A
            [0xFE70, 0xFEFF], // Presentation Forms-B
        ],
    },
    hebrew: { label: '希伯来文 (Hebrew)', ranges: [[0x0590, 0x05FF]] },
    devanagari: { label: '天城文 (Devanagari)', ranges: [[0x0900, 0x097F]] },
    thai: { label: '泰文 (Thai)', ranges: [[0x0E00, 0x0E7F]] },
    digits: {
        label: '数字 (Digits)',
        ranges: [
            [0x0030, 0x0039], // 0-9
            [0xFF10, 0xFF19], // Fullwidth ０-９
        ],
    },
    punctuation: {
        label: '标点/符号 (Punctuation)',
        ranges: [
            [0x0020, 0x002F],
            [0x003A, 0x0040],
            [0x005B, 0x0060],
            [0x007B, 0x007E],
            [0x2000, 0x206F], // General Punctuation
            [0x3000, 0x303F], // CJK Symbols and Punctuation
            [0xFF00, 0xFFEF], // Halfwidth and Fullwidth Forms
        ],
    },
    emoji: {
        label: 'Emoji',
        ranges: [
            [0x2600, 0x27BF], // Misc symbols + Dingbats
            [0x1F000, 0x1FAFF], // Emoji blocks (broad)
        ],
    },
};

export const LOCALE_KEY_PRIORITY = [
    'digits',
    'punctuation',
    'emoji',
    'jp_hiragana',
    'jp_katakana',
    'jp_kana',
    'hangul',
    'bopomofo',
    'cjk',
    'latin',
    'cyrillic',
    'greek',
    'arabic',
    'hebrew',
    'devanagari',
    'thai',
];

export const LOCALE_UI_ORDER = [
    'latin',
    'cjk',
    'jp_kana',
    'hangul',
    'cyrillic',
    'digits',
    'punctuation',
    'emoji',
    'bopomofo',
    'greek',
    'arabic',
    'hebrew',
    'thai',
    'devanagari',
];

