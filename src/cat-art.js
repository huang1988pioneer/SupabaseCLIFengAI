// 貓咪騎機車：像素圖（每個字元是一個像素，. 為透明）。
// 終端機用半格字元 ▀▄ 繪製，一列文字 = 上下兩個像素。

export const CAT_PALETTE = {
  B: [45, 45, 50], // 輪胎
  C: [205, 210, 215], // 金屬
  K: [34, 30, 36], // 描邊
  L: [170, 235, 225], // 車身亮面
  O: [242, 162, 70], // 橘毛
  P: [255, 150, 170], // 粉紅
  S: [92, 60, 45], // 座墊
  T: [54, 190, 175], // 機車車身
  W: [255, 248, 238], // 白毛
  Y: [255, 225, 90], // 大燈
  b: [90, 90, 98], // 胎紋
  c: [130, 135, 140], // 金屬陰影
  e: [255, 255, 255], // 眼睛反光
  o: [201, 115, 42], // 深橘條紋
  t: [30, 125, 118], // 車身陰影
  w: [215, 220, 228], // 排氣
  y: [255, 245, 190], // 燈光
};

export const CAT_PIXELS = [
  '...................K.............K......................',
  '..................KOK...........KOK.....................',
  '..................KOOK.........KOOK.....................',
  '..................KOPOK.......KOPOK.....................',
  '..................KOPPOK.....KOPPOK.....................',
  '..................KOPPPOKKKKKOPPPOK.....................',
  '..................KOPPPOOoOoOoPPPOK.....................',
  '.................KOOPOOOOoOoOoOOPOOK....................',
  '.................KOOOOOKOoOoOOKOOOOK....................',
  '.................KOOOOeeKOOOOeeKOOOK....................',
  '..................KOOOKKKOOOOKKKOOOK....................',
  '.................KOOOOKKeOOOOKKeOOOOK...................',
  '.............KK..KOOoooOOOOOOOOoooOOK..KK...............',
  '...............KKKOOOOOOOPWPOOOOOOOOKKK.................',
  '.............KKKKKOOOPPOWWWPWWOPPOOOKKKKK...............',
  '........KKKK....KOOOOOOOWKWKWKOOOOOOOK..................',
  '.......KOOOOK.KKKKKKKOOOWWWWWWOOOKKKKKKK................',
  '......KOOooK.KK......KOOOOOOOOOOK......KK...............',
  '......KOOKK......KKKKKKKKKKKKKKKKKKKKKKKKKKKK..........y',
  '......KooK......KOOOOOOKKKKKKKOOOOOOWWCCCCCCCK.......y..',
  '......KOOK.....KoOoOOOOOOOOOOOOoOOOOWWcccccccKK.K..y....',
  '......KOOK....KooOoOOOOOOOOOoOOKKKKKKK..KKTTKYYyYK......',
  '.......KOOK..KOoOoOOWWWOOOKKKKK........KTTTTTYYYYK..y..y',
  '.......KooKKKKOOOOOOWWWWWOK...........KTTTTTTKYYK..y....',
  '........KOOOOKKOOOOOWWWWWK............KTLTTTTKKK.....y..',
  '........KOOOOKKOOOOOWOOOOOK..........KTTLTTTK..........y',
  '.........KKOOSSSSOOOOWOOOOOK.........KTLLTTTK...........',
  '.........KSSSSSSSSSSSSSOOOOK.........KTLTTTTK...........',
  '..........KTTTTTTTTTTTTOOOOOK........KTLTTTTK...........',
  '.........KTLLLLLLLLLLLLLOOOOK.......KTTLTTTTK...........',
  '........KTLLLTTTTTTTTTTTTOOOOK......KTTLTTTK............',
  '........KTTTTTTTTTTTTTTTTTOOOKK.....KTLLTTTKKKKK........',
  '.......KTTTTTTTTTTTTTTTTTTOWWWWK....KTLTTTTTTTTBKK......',
  '.......KTTTTTTTTTTTTTTTTTTTWWWWKKKKKKTLTTTTTTTTTBBK.....',
  'ww...wwKTttttttttttttttttTTTTTTTTTTTTTTTTTTTTTTTTTbK....',
  'ww..wwwwKBBTTTTTTTTBKKKKKtttttttttttTTTTTTtttttttttBK...',
  '..ww.wCCCCCCCWCCCBBBK....KKKKKKKKKKKKKKKKBBBCWCCCBBBK...',
  '.wwww.ccccccccccCCBBBK.................KBBBCCcccCCBBBK..',
  '.wwww...bBBCCcccCCBBb...................bBBCCcccCCBBb...',
  '..ww...KBBBCCcccCCBBBK.................KBBBCCcccCCBBBK..',
  '........KBBBCCCCCBBBK...................KBBBCCCCCBBBK...',
  '........KBBBBCCCBBBBK...................KBBBBCCCBBBBK...',
  '.........KbBBBBBBBbK.....................KbBBBBBBBbK....',
  '..........KBBBBBBBK.......................KBBBBBBBK.....',
  '...........KKBbBKK.........................KKBbBKK......',
  '........................................................',
];
