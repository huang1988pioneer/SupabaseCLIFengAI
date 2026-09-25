// 貓咪騎機車：像素圖（每個字元是一個像素，. 為透明）。
// 由 scratch 繪圖腳本產生；終端機用半格字元 ▀▄ 繪製，一列文字 = 上下兩個像素。

export const CAT_PALETTE = {
  B: [45, 45, 50], // 輪胎
  C: [205, 210, 215], // 金屬
  E: [40, 150, 90], // 綠眼睛
  K: [34, 30, 36], // 描邊
  L: [170, 235, 225], // 車身亮面
  O: [242, 162, 70], // 橘毛
  P: [255, 150, 170], // 粉紅
  R: [215, 40, 40], // 紅色安全帽
  S: [92, 60, 45], // 座墊
  T: [54, 190, 175], // 機車車身
  W: [255, 248, 238], // 白毛
  Y: [255, 225, 90], // 大燈
  Z: [245, 120, 150], // 圍巾
  b: [90, 90, 98], // 胎紋
  c: [130, 135, 140], // 金屬陰影
  e: [255, 255, 255], // 眼睛反光
  g: [150, 155, 165], // 地面
  o: [201, 115, 42], // 深橘條紋
  r: [150, 20, 30], // 安全帽陰影
  t: [30, 125, 118], // 車身陰影
  w: [215, 220, 228], // 排氣
  y: [255, 245, 190], // 燈光
  z: [200, 70, 110], // 圍巾陰影
};

export const CAT_PIXELS = [
  '...................K............K.......................',
  '..................KOK....KK....KOK......................',
  '..................KOOKKKKRRKKKKOOK......................',
  '..................KOPPORRWWRROPPOK......................',
  '...................KPPPWRRRRRPPPK.......................',
  '...................KPORRRRRRRROPK.......................',
  '...................KOKRRRRRRRROOK.......................',
  '....................KOrrrrrrrrrOK.......................',
  '...................KOOrOOoooOOrOOK......................',
  '...................KOOOOOOOOOOOOOK......................',
  '...................KOOOeEOOOeEOOOK......................',
  '.......KKKK....K...KOOOEKOPPEKOOOK...KK.................',
  '......KOOOOK...KKKKOOOPOWWWWWOOPOOKKKK..................',
  '.....KOooOOK.KKKKKKOOOOOWKKKKOOOOOKK.KKKKKKKK..........y',
  '.....KOOKKK.KZZzKZZOOOOOOOWWOOOOKKKKKKKCCCCCCK.......y..',
  '.....KooK....KKzozozzZZZZZZZZZZOOOOOWWcccccccKK.K..y....',
  '.....KOOK.....KOoZoZOWzzzzzzozzOoOOOWWK.KKTTKYYyYK......',
  '.....KOOK....KOooZoOWWWWOOOOOOKKKKKKKK.KTTTTTYYYYK..y..y',
  '......KOOKK..KOoOOoOWWWWWWOKKK........KTTTTTTKYYK..y....',
  '.......KOooKKKOOOOOOWWWWWWOK..........KTLTTTTKKK.....y..',
  '.......KOOOOOKKOOOOOWWWWWWK..........KTTLTTTK..........y',
  '........KKOOOSSSOOOOOWWOOOOKK........KTLLTTTK...........',
  '.........KSSSSSSSSOOOOOOOOOOOK.......KTLTTTTK...........',
  '..........KTTTTTTTTTTOOOOOOOOK.......KTLTTTTK...........',
  '.........KTLLLLLLLLLLOOOOOOOOK......KTTLTTTTK...........',
  '........KTLLLTTTTTTTTTTTTTOOOK......KTTLTTTK............',
  '........KTTTTTTTTTTTTTTTTTOOOKK.....KTLLTTTKKKKK........',
  '.......KTTTTTTTTTTTTTTTTTTTWWWWK....KTLTTTTTTTTBKK......',
  '.......KTTTTTTTTTTTTTTTTTTTWWWWKKKKKKTLTTTTTTTTTBBK.....',
  'ww...wwKTttttttttttttttttTTTTTTTTTTTTTTTTTTTTTTTTTbK....',
  'ww..wwwwKBBTTTTTTTTBKKKKKtttttttttttTTTTTTTBBCCCBBBBK...',
  '..ww.wCCCCCCCWCCCBBBK....KKKKKKKKKKKKKKKKBtttttttttBK...',
  '.wwww.ccccccccccCCBBBK.................KBBBCCcccCCBBBK..',
  '.wwww...bBBCCcccCCBBb...................bBBCCcccCCBBb...',
  '..ww...KBBBCCcccCCBBBK.................KBBBCCcccCCBBBK..',
  '........KBBBCCCCCBBBK...................KBBBCCCCCBBBK...',
  '........KBBBBCCCBBBBK...................KBBBBCCCBBBBK...',
  '.........KbBBBBBBBbK.....................KbBBBBBBBbK....',
  '..........KBBBBBBBK.......................KBBBBBBBK.....',
  '...........KKBbBKK.........................KKBbBKK......',
  '.g.g.g.g.g.g.g.g.g.g.g.g.g.g.g.g.g.g.g.g.g.g.g.g.g.g.g.g',
  '........................................................',
];
