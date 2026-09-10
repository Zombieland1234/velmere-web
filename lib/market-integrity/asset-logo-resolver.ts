import {
  resolvePass481ExchangeBrand,
  resolvePass481Glyph,
  resolvePass481Identity,
} from "@/lib/market-integrity/asset-identity-registry";

export type VelmereAssetClass =
  | "crypto"
  | "exchange_token"
  | "stock"
  | "etf"
  | "fx"
  | "commodity"
  | "real_estate"
  | "index"
  | "exchange"
  | "market";

export type VelmereAssetLogoInput = {
  symbol: string;
  providerSymbol?: string;
  name?: string;
  id?: string;
  assetClass?: VelmereAssetClass | string;
  imageUrl?: string;
  image?: string;
  logo?: string;
  icon?: string;
  domain?: string;
  venue?: string;
};

export type VelmereAssetLogoResolution = {
  symbol: string;
  glyph: string;
  label: string;
  tone: string;
  imageCandidates: string[];
};

export const PASS4576_ICON_AUTHORITY_CONTRACT = {
  passId: "PASS4576",
  purpose: "Verified local vector marks resolve before provider routes; ticker-only local placeholders never override a real CoinGecko/company image.",
  publicTopkaLiveAllowed: false,
  rule: "Canonical vector maps are authority for known high-visibility symbols; otherwise trusted provider imagery wins and a labelled badge is the final fallback only.",
} as const;


const LOCAL_BRAND_LOGOS: Record<string, string> = {
  MSFT: "/market-logos/msft.svg",
  MICROSOFT: "/market-logos/msft.svg",
  AAPL: "/market-logos/aapl.svg",
  APPLE: "/market-logos/aapl.svg",
  NVDA: "/market-logos/nvda.svg",
  NVIDIA: "/market-logos/nvda.svg",
  GOOGL: "/market-logos/googl.svg",
  GOOG: "/market-logos/googl.svg",
  ALPHABET: "/market-logos/googl.svg",
  AMZN: "/market-logos/amzn.svg",
  AMAZON: "/market-logos/amzn.svg",
  META: "/market-logos/meta.svg",
  TSLA: "/market-logos/tsla.svg",
  SAP: "/market-logos/sap.svg",
  VISA: "/market-logos/visa.svg",
  MA: "/market-logos/mastercard.svg",
  MASTERCARD: "/market-logos/mastercard.svg",
  NFLX: "/market-logos/nflx.svg",
  ADBE: "/market-logos/adbe.svg",
  AMD: "/market-logos/amd.svg",
  INTC: "/market-logos/intc.svg",
  INTEL: "/market-logos/intc.svg",
  ORCL: "/market-logos/orcl.svg",
  ORACLE: "/market-logos/orcl.svg",
  IBM: "/market-logos/ibm.svg",
  JPM: "/market-logos/jpm.svg",
  JPMORGAN: "/market-logos/jpm.svg",
  COIN: "/market-logos/coin.svg",
  COINBASE: "/market-logos/coinbase.svg",
  NDAQ: "/market-logos/ndaq.svg",
  NASDAQ: "/market-logos/nasdaq.svg",
  CRM: "/market-logos/crm.svg",
  SALESFORCE: "/market-logos/crm.svg",
  ASML: "/market-logos/asml.svg",
  QCOM: "/market-logos/qcom.svg",
  QUALCOMM: "/market-logos/qcom.svg",
  TXN: "/market-logos/txn.svg",
  ARM: "/market-logos/arm.svg",
  UBER: "/market-logos/uber.svg",
  ABNB: "/market-logos/abnb.svg",
  AIRBNB: "/market-logos/abnb.svg",
  BABA: "/market-logos/baba.svg",
  BMW: "/market-logos/bmw.svg",
  "BMW.DE": "/market-logos/bmw.svg",
  MBG: "/market-logos/mercedes.svg",
  "MBG.DE": "/market-logos/mercedes.svg",
  MERCEDES: "/market-logos/mercedes.svg",
  ADS: "/market-logos/adidas.svg",
  "ADS.DE": "/market-logos/adidas.svg",
  ADIDAS: "/market-logos/adidas.svg",
  SONY: "/market-logos/sony.svg",
  SHOP: "/market-logos/shop.svg",
  LVMH: "/market-logos/lvmh.svg",
  BINANCE: "/market-logos/binance.svg",
  MEXC: "/market-logos/mexc.svg",
  OKX: "/market-logos/okx.svg",
  BYBIT: "/market-logos/bybit.svg",
  KRAKEN: "/market-logos/kraken.svg",

  TSM: "/market-logos/tsm.svg",
  TAIWANSEMICONDUCTOR: "/market-logos/tsm.svg",
  AVGO: "/market-logos/avgo.svg",
  BROADCOM: "/market-logos/avgo.svg",
  WMT: "/market-logos/wmt.svg",
  WALMART: "/market-logos/wmt.svg",
  DIS: "/market-logos/dis.svg",
  DISNEY: "/market-logos/dis.svg",
  HD: "/market-logos/hd.svg",
  HOMEDEPOT: "/market-logos/hd.svg",
   BAC: "/market-logos/bac.svg",
  BANKOFAMERICA: "/market-logos/bac.svg",
  BRK: "/market-logos/brk.svg",
  "BRK.B": "/market-logos/brk.svg",
  "BRK-B": "/market-logos/brk.svg",
  BRKB: "/market-logos/brk.svg",
  BERKSHIRE: "/market-logos/brk.svg",
  BERKSHIREHATHAWAY: "/market-logos/brk.svg",
  LLY: "/market-logos/lly.svg",
  LILLY: "/market-logos/lly.svg",
  ELILILLY: "/market-logos/lly.svg",
  DXY: "/market-logos/dxy.svg",
  USDOLLAR: "/market-logos/dxy.svg",
  DOLLARINDEX: "/market-logos/dxy.svg",
  VOW3: "/market-logos/vw.svg",
  "VOW3.DE": "/market-logos/vw.svg",
  VW: "/market-logos/vw.svg",
  VOLKSWAGEN: "/market-logos/vw.svg",
  RACE: "/market-logos/race.svg",
  FERRARI: "/market-logos/race.svg",
  MU: "/market-logos/mu.svg",
  MICRON: "/market-logos/mu.svg",
  LRCX: "/market-logos/lrcx.svg",
  LAMRESEARCH: "/market-logos/lrcx.svg",
  KLAC: "/market-logos/klac.svg",
  KLA: "/market-logos/klac.svg",
  NET: "/market-logos/net.svg",
  CLOUDFLARE: "/market-logos/net.svg",
  PYPL: "/market-logos/pypl.svg",
  PAYPAL: "/market-logos/pypl.svg",
  HOOD: "/market-logos/hood.svg",
  ROBINHOOD: "/market-logos/hood.svg",
  MELI: "/market-logos/meli.svg",
  MERCADOLIBRE: "/market-logos/meli.svg",
  TEAM: "/market-logos/team.svg",
  ATLASSIAN: "/market-logos/team.svg",
  SPOT: "/market-logos/spot.svg",
  SPOTIFY: "/market-logos/spot.svg",
  SCHW: "/market-logos/schw.svg",
  UBS: "/market-logos/ubs.svg",
  HSBC: "/market-logos/hsbc.svg",
  RY: "/market-logos/ry.svg",
  TD: "/market-logos/td.svg",
  ENB: "/market-logos/enb.svg",
  COP: "/market-logos/cop.svg",
  SLB: "/market-logos/slb.svg",
  BK: "/market-logos/bk.svg",
  BNP: "/market-logos/bnp.svg",
  ACA: "/market-logos/aca.svg",
  DB1: "/market-logos/db1.svg",
  "DB1.DE": "/market-logos/db1.svg",
  DEUTSCHEBOERSE: "/market-logos/db1.svg",
  CME: "/market-logos/cme.svg",
  ICE: "/market-logos/ice.svg",
  SPY: "/market-logos/spy.svg",
  QQQ: "/market-logos/qqq.svg",
  GLD: "/market-logos/gld.svg",
  SLV: "/market-logos/slv.svg",
  USO: "/market-logos/uso.svg",
  VNQ: "/market-logos/vnq.svg",
  IYR: "/market-logos/iyr.svg",
  PLD: "/market-logos/pld.svg",

  NVO: "/market-logos/nvo.svg",
  NOVONORDISK: "/market-logos/nvo.svg",
  UNH: "/market-logos/unh.svg",
  UNITEDHEALTH: "/market-logos/unh.svg",
  JNJ: "/market-logos/jnj.svg",
  JOHNSONJOHNSON: "/market-logos/jnj.svg",
  XOM: "/market-logos/xom.svg",
  EXXONMOBIL: "/market-logos/xom.svg",
  PG: "/market-logos/pg.svg",
  PROCTERGAMBLE: "/market-logos/pg.svg",
  COST: "/market-logos/cost.svg",
  COSTCO: "/market-logos/cost.svg",
  ABBV: "/market-logos/abbv.svg",
  ABBVIE: "/market-logos/abbv.svg",
  KO: "/market-logos/ko.svg",
  COCACOLA: "/market-logos/ko.svg",
  PEP: "/market-logos/pep.svg",
  PEPSICO: "/market-logos/pep.svg",
  MRK: "/market-logos/mrk.svg",
  MERCK: "/market-logos/mrk.svg",
  CVX: "/market-logos/cvx.svg",
  CHEVRON: "/market-logos/cvx.svg",
  TMO: "/market-logos/tmo.svg",
  THERMOFISHER: "/market-logos/tmo.svg",
  ACN: "/market-logos/acn.svg",
  ACCENTURE: "/market-logos/acn.svg",
  MCD: "/market-logos/mcd.svg",
  MCDONALDS: "/market-logos/mcd.svg",
  LIN: "/market-logos/lin.svg",
  LINDE: "/market-logos/lin.svg",
  CSCO: "/market-logos/csco.svg",
  CISCO: "/market-logos/csco.svg",
  WFC: "/market-logos/wfc.svg",
  WELLSFARGO: "/market-logos/wfc.svg",
  GE: "/market-logos/ge.svg",
  GENERALELECTRIC: "/market-logos/ge.svg",
  CAT: "/market-logos/cat.svg",
  CATERPILLAR: "/market-logos/cat.svg",
  AMGN: "/market-logos/amgn.svg",
  AMGEN: "/market-logos/amgn.svg",
  ISRG: "/market-logos/isrg.svg",
  INTUITIVESURGICAL: "/market-logos/isrg.svg",
  GS: "/market-logos/gs.svg",
  GOLDMANSACHS: "/market-logos/gs.svg",
  MS: "/market-logos/ms.svg",
  MORGANSTANLEY: "/market-logos/ms.svg",
  RTX: "/market-logos/rtx.svg",
  LOW: "/market-logos/low.svg",
  LOWES: "/market-logos/low.svg",
  HON: "/market-logos/hon.svg",
  HONEYWELL: "/market-logos/hon.svg",
  BKNG: "/market-logos/bkng.svg",
  BOOKING: "/market-logos/bkng.svg",
  PANW: "/market-logos/panw.svg",
  PALOALTONETWORKS: "/market-logos/panw.svg",
  NOW: "/market-logos/now.svg",
  SERVICENOW: "/market-logos/now.svg",
  CRWD: "/market-logos/crwd.svg",
  CROWDSTRIKE: "/market-logos/crwd.svg",
  SNOW: "/market-logos/snow.svg",
  SNOWFLAKE: "/market-logos/snow.svg",
  SMCI: "/market-logos/smci.svg",
  SUPERMICRO: "/market-logos/smci.svg",
  MSTR: "/market-logos/mstr.svg",
  MICROSTRATEGY: "/market-logos/mstr.svg",
  VOO: "/market-logos/voo.svg",
  VTI: "/market-logos/vti.svg",
  DIA: "/market-logos/dia.svg",
  IWM: "/market-logos/iwm.svg",
  EFA: "/market-logos/efa.svg",
  EEM: "/market-logos/eem.svg",
  TLT: "/market-logos/tlt.svg",
  HYG: "/market-logos/hyg.svg",
  LQD: "/market-logos/lqd.svg",
  XLF: "/market-logos/xlf.svg",
  XLE: "/market-logos/xle.svg",
  XLK: "/market-logos/xlk.svg",
  XLV: "/market-logos/xlv.svg",
  ARKK: "/market-logos/arkk.svg",
  XETRA: "/market-logos/xetra.svg",
  EUREX: "/market-logos/eurex.svg",
  NYSE: "/market-logos/nyse.svg",
  CBOE: "/market-logos/cboe.svg",
  LSE: "/market-logos/lse.svg",
  EURONEXT: "/market-logos/euronext.svg",
  HKEX: "/market-logos/hkex.svg",
  JPX: "/market-logos/jpx.svg",
  BITGET: "/market-logos/bitget.svg",
  KUCOIN: "/market-logos/kucoin.svg",
  GATEIO: "/market-logos/gateio.svg",
  GATE: "/market-logos/gateio.svg",
  DERIBIT: "/market-logos/deribit.svg",
  FTX: "/market-logos/ftx.svg",

  BTC: "/market-logos/btc.svg",
  BITCOIN: "/market-logos/btc.svg",
  ETH: "/market-logos/eth.svg",
  ETHEREUM: "/market-logos/eth.svg",
  BNB: "/market-logos/bnb.svg",
  JUP: "/market-logos/jup.svg",
  JUPITER: "/market-logos/jup.svg",
  SOL: "/market-logos/sol.svg",
  XRP: "/market-logos/xrp.svg",
  ADA: "/market-logos/ada.svg",
  DOGE: "/market-logos/doge.svg",
  AVAX: "/market-logos/avax.svg",
  DOT: "/market-logos/dot.svg",
  LINK: "/market-logos/link.svg",
  V: "/market-logos/visa.svg",
  NKE: "/market-logos/nke.svg",
  NIKE: "/market-logos/nke.svg",
  AIR: "/market-logos/air.svg",
  "AIR.PA": "/market-logos/air.svg",
  AIRBUS: "/market-logos/air.svg",
  RMS: "/market-logos/rms.svg",
  HERMES: "/market-logos/rms.svg",
  KER: "/market-logos/ker.svg",
  KERING: "/market-logos/ker.svg",
  CFR: "/market-logos/cfr.svg",
  RICHEMONT: "/market-logos/cfr.svg",
  MC: "/market-logos/lvmh.svg",
  "MC.PA": "/market-logos/lvmh.svg",
  LVMUY: "/market-logos/lvmh.svg",
  OR: "/market-logos/or.svg",
  "OR.PA": "/market-logos/or.svg",
  LOREAL: "/market-logos/or.svg",
  SIE: "/market-logos/sie.svg",
  SIEMENS: "/market-logos/sie.svg",
  ALV: "/market-logos/alv.svg",
  ALLIANZ: "/market-logos/alv.svg",
  P911: "/market-logos/porsche.svg",
  "P911.DE": "/market-logos/porsche.svg",
  PORSCHE: "/market-logos/porsche.svg",
  LSEG: "/market-logos/lseg.svg",
  "LSEG.L": "/market-logos/lseg.svg",
  LONDONSTOCKEXCHANGEGROUP: "/market-logos/lseg.svg",
  IWDP: "/market-logos/iwdp.svg",
  XLRE: "/market-logos/xlre.svg",
  SP500: "/market-logos/sp500.svg",
  SANDP500: "/market-logos/sp500.svg",
  NDX: "/market-logos/ndx.svg",
  NASDAQ100: "/market-logos/ndx.svg",
  DAX: "/market-logos/dax.svg",
  FTSE: "/market-logos/ftse.svg",
  NIKKEI: "/market-logos/nikkei.svg",
  STOXX50E: "/market-logos/stoxx50e.svg",
  WIG20TR: "/market-logos/wig20tr.svg",
  EURUSD: "/market-logos/eurusd.svg",
  "EUR/USD": "/market-logos/eurusd.svg",
  "EUR-USD": "/market-logos/eurusd.svg",
  GBPUSD: "/market-logos/gbpusd.svg",
  "GBP/USD": "/market-logos/gbpusd.svg",
  "BTC/USD": "/market-logos/btc.svg",
  "BTC-USD": "/market-logos/btc.svg",
  "BTC/USD CME FUTURES": "/market-logos/btc.svg",
  "BTC CME": "/market-logos/btc.svg",
  "BTC=F": "/market-logos/btc.svg",
  USDJPY: "/market-logos/usdjpy.svg",
  USDCHF: "/market-logos/usdchf.svg",
  EURGBP: "/market-logos/eurgbp.svg",
  EURPLN: "/market-logos/eurpln.svg",
  USDPLN: "/market-logos/usdpln.svg",
  EURTRY: "/market-logos/eurtry.svg",
  USDTRY: "/market-logos/usdtry.svg",
  GC: "/market-logos/gc.svg",
  GOLD: "/market-logos/gc.svg",
  "GC=F": "/market-logos/gld.svg",
  SI: "/market-logos/si.svg",
  SILVER: "/market-logos/si.svg",
  CL: "/market-logos/cl.svg",
  OIL: "/market-logos/cl.svg",
  "CL=F": "/market-logos/uso.svg",
  BZ: "/market-logos/bz.svg",
  BRENT: "/market-logos/bz.svg",
  NG: "/market-logos/ng.svg",
  NATGAS: "/market-logos/ng.svg",
  HG: "/market-logos/hg.svg",
  COPPER: "/market-logos/hg.svg",
  ZW: "/market-logos/zw.svg",
  WHEAT: "/market-logos/zw.svg",
  HK0388: "/market-logos/hk0388.svg",
  HKEX388: "/market-logos/hk0388.svg",
  "0388HK": "/market-logos/hk0388.svg",
  "BRK.A": "/market-logos/brk.svg",
  "BRK/B": "/market-logos/brk.svg",
  "EURUSD=X": "/market-logos/eurusd.svg",
};


const DOMAIN_BRAND_LOGOS: Record<string, string> = {
  "apple.com": "/market-logos/aapl.svg",
  "nvidia.com": "/market-logos/nvda.svg",
  "microsoft.com": "/market-logos/msft.svg",
  "amazon.com": "/market-logos/amzn.svg",
  "meta.com": "/market-logos/meta.svg",
  "google.com": "/market-logos/googl.svg",
  "alphabet.com": "/market-logos/googl.svg",
  "netflix.com": "/market-logos/nflx.svg",
  "tesla.com": "/market-logos/tsla.svg",
  "amd.com": "/market-logos/amd.svg",
  "intel.com": "/market-logos/intc.svg",
  "oracle.com": "/market-logos/orcl.svg",
  "ibm.com": "/market-logos/ibm.svg",
  "sap.com": "/market-logos/sap.svg",
  "asml.com": "/market-logos/asml.svg",
  "adidas.com": "/market-logos/adidas.svg",
  "coinbase.com": "/market-logos/coinbase.svg",
  "binance.com": "/market-logos/binance.svg",
  "mexc.com": "/market-logos/mexc.svg",
  "okx.com": "/market-logos/okx.svg",
  "bybit.com": "/market-logos/bybit.svg",
  "kraken.com": "/market-logos/kraken.svg",
  "gate.io": "/market-logos/gateio.svg",
  "bitget.com": "/market-logos/bitget.svg",
  "kucoin.com": "/market-logos/kucoin.svg",
};

const LOCAL_CRYPTO_LOGOS: Record<string, string> = {
  BTC: "/market-logos/btc.svg",
  BITCOIN: "/market-logos/btc.svg",
  ETH: "/market-logos/eth.svg",
  ETHEREUM: "/market-logos/eth.svg",
  USDT: "/market-logos/usdt.svg",
  TETHER: "/market-logos/usdt.svg",
  USDC: "/market-logos/usdc.svg",
  BNB: "/market-logos/bnb.svg",
  BINANCECOIN: "/market-logos/bnb.svg",
  BINANCE: "/market-logos/bnb.svg",
  SOL: "/market-logos/sol.svg",
  SOLANA: "/market-logos/sol.svg",
  XRP: "/market-logos/xrp.svg",
  RIPPLE: "/market-logos/xrp.svg",
  DOGE: "/market-logos/doge.svg",
  DOGECOIN: "/market-logos/doge.svg",
  ADA: "/market-logos/ada.svg",
  CARDANO: "/market-logos/ada.svg",
  AVAX: "/market-logos/avax.svg",
  AVALANCHE: "/market-logos/avax.svg",
  DOT: "/market-logos/dot.svg",
  POLKADOT: "/market-logos/dot.svg",
  LINK: "/market-logos/link.svg",
  CHAINLINK: "/market-logos/link.svg",
  COIN: "/market-logos/coin.svg",
  COINBASE: "/market-logos/coinbase.svg",
  TRX: "/market-logos/trx.svg",
  XLM: "/market-logos/xlm.svg",
  SUI: "/market-logos/sui.svg",
  BCH: "/market-logos/bch.svg",
  HBAR: "/market-logos/hbar.svg",
  LTC: "/market-logos/ltc.svg",
  TON: "/market-logos/ton.svg",
  SHIB: "/market-logos/shib.svg",
  UNI: "/market-logos/uni.svg",
  PEPE: "/market-logos/pepe.svg",
  NEAR: "/market-logos/near.svg",
  APT: "/market-logos/apt.svg",
  ICP: "/market-logos/icp.svg",
  AAVE: "/market-logos/aave.svg",
  ETC: "/market-logos/etc.svg",
  TAO: "/market-logos/tao.svg",
  FIL: "/market-logos/fil.svg",
  ARB: "/market-logos/arb.svg",
  ALGO: "/market-logos/algo.svg",
  ATOM: "/market-logos/atom.svg",
  TIA: "/market-logos/tia.svg",
  INJ: "/market-logos/inj.svg",
  OP: "/market-logos/op.svg",
  POL: "/market-logos/pol.svg",
  MKR: "/market-logos/mkr.svg",
  FDUSD: "/market-logos/fdusd.svg",
  IMX: "/market-logos/imx.svg",
  BONK: "/market-logos/bonk.svg",
  STX: "/market-logos/stx.svg",
  GRT: "/market-logos/grt.svg",
  LDO: "/market-logos/ldo.svg",
  WLD: "/market-logos/wld.svg",
  SEI: "/market-logos/sei.svg",
  ONDO: "/market-logos/ondo.svg",
  GALA: "/market-logos/gala.svg",
  FLOKI: "/market-logos/floki.svg",
  SAND: "/market-logos/sand.svg",
  EOS: "/market-logos/eos.svg",
  QNT: "/market-logos/qnt.svg",
  XTZ: "/market-logos/xtz.svg",
  FLOW: "/market-logos/flow.svg",
  CRV: "/market-logos/crv.svg",
  AR: "/market-logos/ar.svg",
  PYTH: "/market-logos/pyth.svg",
  ENS: "/market-logos/ens.svg",
  NEO: "/market-logos/neo.svg",
  IOTA: "/market-logos/iota.svg",
  AXS: "/market-logos/axs.svg",
  MANA: "/market-logos/mana.svg",
  RUNE: "/market-logos/rune.svg",
  PENDLE: "/market-logos/pendle.svg",
  CHZ: "/market-logos/chz.svg",
  CAKE: "/market-logos/cake.svg",
  COMP: "/market-logos/comp.svg",
  SNX: "/market-logos/snx.svg",
  ZEC: "/market-logos/zec.svg",
  XEC: "/market-logos/xec.svg",
  KAVA: "/market-logos/kava.svg",
  "1INCH": "/market-logos/1inch.svg",
  NEXO: "/market-logos/nexo.svg",
  CFX: "/market-logos/cfx.svg",
  RPL: "/market-logos/rpl.svg",
  BLUR: "/market-logos/blur.svg",
  ZIL: "/market-logos/zil.svg",
  ANKR: "/market-logos/ankr.svg",
  LRC: "/market-logos/lrc.svg",
  BAL: "/market-logos/bal.svg",
  BALANCER: "/market-logos/bal.svg",
  BAT: "/market-logos/bat.svg",
  BASICATTENTIONTOKEN: "/market-logos/bat.svg",
  BNT: "/market-logos/bnt.svg",
  BANCOR: "/market-logos/bnt.svg",
  ENJ: "/market-logos/enj.svg",
  ENJIN: "/market-logos/enj.svg",
  KNC: "/market-logos/knc.svg",
  KYBER: "/market-logos/knc.svg",
  KYBERNETWORK: "/market-logos/knc.svg",
  REN: "/market-logos/ren.svg",
  SUSHI: "/market-logos/sushi.svg",
  SUSHISWAP: "/market-logos/sushi.svg",
  VET: "/market-logos/vet.svg",
  VECHAIN: "/market-logos/vet.svg",
  YFI: "/market-logos/yfi.svg",
  YEARN: "/market-logos/yfi.svg",
  YEARNFINANCE: "/market-logos/yfi.svg",
  MATIC: "/market-logos/pol.svg",
  POLYGON: "/market-logos/pol.svg",
  RNDR: "/market-logos/render.svg",
  RENDER: "/market-logos/render.svg",
};

/**
 * Only artwork in this allow-list is a genuine, shape-based brand mark.
 *
 * The market-logos directory also contains deliberately conservative ticker
 * badges.  Those are useful as a last-resort label, but they must never win
 * over a source-provided CoinGecko/company image: doing so made assets such as
 * XRP, Cardano and dozens of equities look as if they had a logo while only
 * rendering their ticker in a decorative square.
 */
const AUTHENTIC_LOCAL_MARKET_KEYS = new Set([
  "1inch", "aapl", "aave", "abnb", "acn", "ada", "adbe", "adidas", "air", "algo",
  "alibabadotcom", "amd", "amzn", "ankr", "apt", "ar", "arb", "arm", "atom", "avax", "avgo", "axs",
  "baba", "bac", "bal", "bat", "bch", "binance", "blur", "bmw", "bnb", "bnt", "bonk", "broadcom",
  "btc", "cake", "cat", "cfx", "chase", "chz", "coin", "coinbase", "comp", "crm", "crv", "csco",
  "dax", "doge", "dot", "enj", "ens", "eos", "etc", "eth", "fdusd", "fil",
  "floki", "flow", "gala", "ge", "googl", "grt", "gs", "hbar", "hood", "hsbc",
  "ibm", "icp", "imx", "inj", "intc", "iota", "jpm", "jup", "kava", "knc", "ko", "kucoin",
  "ldo", "link", "lrc", "ltc", "mana", "mastercard", "mcd", "meta", "mkr", "mrk",
  "msft", "mstr", "near", "neo", "net", "nexo", "nflx", "nke", "nvda", "okx",
  "ondo", "op", "oracle", "orcl", "panw", "pendle", "pepe", "pol", "porsche", "pypl", "pyth", "qcom",
  "qnt", "qqq", "race", "ren", "render", "rpl", "rune", "salesforce", "sand", "sap", "sei",
  "shib", "shop", "sie", "smci", "snow", "snx", "sol", "sony", "spot", "spy",
  "stx", "sui", "sushi", "tao", "team", "tia", "ton", "trx", "tsla", "uber",
  "uma", "uni", "usdc", "usdt", "vet", "visa", "vw", "wfc", "wld", "xec", "xlm",
  "xrp", "xtz", "yfi", "zec", "zil",
  "brk", "wmt", "lly", "gld", "uso", "tlt", "dxy", "eurusd", "gc", "cl",
  "sp500", "ndx", "dia", "iwm", "voo", "vti", "xle", "xlf", "xlk", "xlv",
  "usdjpy", "usdchf", "gbpusd", "eurpln", "usdpln", "eurgbp", "eurtry", "usdtry",
  "si", "bz", "ng", "hg", "zw", "hk0388"
]);

const CANONICAL_LOCAL_LOGO_PATHS = new Set(
  Array.from(AUTHENTIC_LOCAL_MARKET_KEYS).map((key) => `/market-logos/${key}.svg`)
);

function canonicalLocalLogo(path?: string) {
  if (!path) return undefined;
  // Strictly enforce authentic vector logos; text-badge placeholders are rejected
  return CANONICAL_LOCAL_LOGO_PATHS.has(path) ? path : undefined;
}

function buildLogoLookupKeys(...values: Array<string | undefined>) {
  return values
    .flatMap((value) => {
      const raw = String(value ?? "").trim().toUpperCase();
      if (!raw) return [] as string[];
      const sanitized = raw
        .replace(/[.'’]/g, "")
        .replace(/\s+(INC|INCORPORATED|GROUP|AG|SE|PLC|CORP|CORPORATION|HOLDINGS|TECHNOLOGIES|TECH|COMPANY|CO|PREFERENCE|CLASS A|CLASS B|HLDG|LTD)$/gi, "")
        .replace(/\s+/g, " ")
        .trim();
      const normalized = sanitized.replace(/[^A-Z0-9]/g, "");
      const withoutExchange = raw.replace(/[./-].*$/, "");
      const withoutQuote = raw.replace(/[-/]?(USD|USDT|USDC)$/i, "");
      const withoutQuoteNormalized = withoutQuote.replace(/[^A-Z0-9]/g, "");
      const list = [raw, sanitized, normalized, withoutExchange, withoutQuote, withoutQuoteNormalized];
      return list.filter(Boolean);
    })
    .filter((value, index, array) => array.indexOf(value) === index);
}

function localMappedLogo(path?: string) {
  if (!path) return undefined;
  // Always filter through canonicalLocalLogo so non-authentic SVGs are never delivered as canonical
  return canonicalLocalLogo(path);
}

function resolveLocalCryptoLogo(symbol: string, name?: string, id?: string) {
  const keys = buildLogoLookupKeys(symbol, name, id);
  for (const key of keys) {
    const match = localMappedLogo(LOCAL_CRYPTO_LOGOS[key]);
    if (match) return match;
  }
  // Direct symbol match fallback ONLY for verified authentic vector logos:
  const directSymbol = symbol.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (directSymbol && AUTHENTIC_LOCAL_MARKET_KEYS.has(directSymbol)) {
    return `/market-logos/${directSymbol}.svg`;
  }

  return undefined;
}

function extractBrandDomain(value?: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const url = raw.startsWith("/") ? new URL(raw, "https://velmere.local") : new URL(raw);
    const directDomain = url.searchParams.get("domain")?.trim().toLowerCase();
    if (directDomain) return directDomain.replace(/^www\./, "");
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return raw
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "");
  }
}

function isBrandIconRoute(value?: string) {
  return String(value ?? "").includes("/api/market-integrity/brand-icon");
}

function firstProviderImage(...values: unknown[]) {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const clean = value.trim();
    if (clean.startsWith("/") || clean.startsWith("https://")) return clean;
  }
  return undefined;
}

function controlledBrandIconRoute(value?: string) {
  const domain = extractBrandDomain(value);
  if (
    !domain ||
    domain.length > 120 ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/i.test(domain) ||
    domain.endsWith(".local") ||
    domain.endsWith(".internal")
  ) return undefined;
  return `/api/market-integrity/brand-icon?domain=${encodeURIComponent(domain)}`;
}

function resolveDomainBrandLogo(domain?: string) {
  const clean = extractBrandDomain(domain);
  if (!clean) return undefined;
  return localMappedLogo(DOMAIN_BRAND_LOGOS[clean]);
}

function resolveLocalBrandLogo(symbol: string, name?: string, id?: string, venue?: string, imageUrl?: string) {
  const domainLogo = resolveDomainBrandLogo(imageUrl);
  if (domainLogo) return domainLogo;
  const keys = buildLogoLookupKeys(symbol, name, id, venue);
  for (const key of keys) {
    const match = localMappedLogo(LOCAL_BRAND_LOGOS[key]);
    if (match) return match;
  }
  const directSymbol = symbol.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (directSymbol && AUTHENTIC_LOCAL_MARKET_KEYS.has(directSymbol)) {
    return `/market-logos/${directSymbol}.svg`;
  }
  return undefined;
}

function unique(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function trustedInputLogo(url?: string) {
  if (!url) return undefined;
  // A caller may still hold one of the historical ticker-only files. Treat it
  // as missing so the resolver can continue to CoinGecko/brand/SimpleIcons.
  if (url.startsWith("/market-logos/")) return canonicalLocalLogo(url);
  return proxiedVelmereLogo(url);
}

export function proxiedVelmereLogo(url?: string) {
  if (!url) return undefined;
  if (url.startsWith("/")) return url;
  if (!url.startsWith("https://")) return undefined;
  return `/api/market-integrity/icon?url=${encodeURIComponent(url)}`;
}

function normalizeAssetClass(value?: string): VelmereAssetClass {
  const normalized = String(value ?? "market").trim().toLowerCase();
  if (
    normalized === "crypto" ||
    normalized === "exchange_token" ||
    normalized === "stock" ||
    normalized === "etf" ||
    normalized === "fx" ||
    normalized === "commodity" ||
    normalized === "real_estate" ||
    normalized === "index" ||
    normalized === "exchange"
  ) return normalized;
  return "market";
}

export function resolveVelmereAssetLogo(input: VelmereAssetLogoInput): VelmereAssetLogoResolution {
  const rawSymbol = String(input.symbol ?? "").trim().toUpperCase();
  const rawProviderSymbol = String(input.providerSymbol ?? "").trim().toUpperCase();
  const symbol = rawSymbol || rawProviderSymbol || "MARKET";
  const venue = String(input.venue ?? input.name ?? symbol).trim();
  const requestedClass = normalizeAssetClass(input.assetClass);
  const identity = resolvePass481Identity(symbol) ?? resolvePass481Identity(rawProviderSymbol) ?? resolvePass481Identity(venue);
  const assetClass = requestedClass === "market" ? identity?.assetClass ?? "market" : requestedClass;
  const isCrypto = assetClass === "crypto" || assetClass === "exchange_token";
  const isExchange = assetClass === "exchange";
  const sourceImage = firstProviderImage(input.imageUrl, input.image, input.logo, input.icon)
    ?? (!isCrypto ? controlledBrandIconRoute(input.domain) : undefined);
  const simpleIcon = identity?.simpleIcon ?? resolvePass481ExchangeBrand(venue) ?? resolvePass481ExchangeBrand(symbol);
  const providerSymbol = encodeURIComponent(rawProviderSymbol || symbol);
  const localCryptoLogo = resolveLocalCryptoLogo(symbol, input.name || identity?.label, input.id ?? rawProviderSymbol);
  const localBrandLogo = resolveLocalBrandLogo(symbol, input.name || identity?.label, input.id, input.venue ?? rawProviderSymbol, sourceImage);
  const providerImageLogo = trustedInputLogo(sourceImage);
  const identityImageLogo = proxiedVelmereLogo(identity?.imageUrl);
  const trustedMappedLogo = isCrypto
    ? (localCryptoLogo ?? localBrandLogo)
    : (localBrandLogo ?? localCryptoLogo);
  const preferProviderBrand = !isCrypto && isBrandIconRoute(sourceImage);
  const apiProviderLogo = !isCrypto && !isExchange
    ? `/api/market-integrity/asset-logo?symbol=${providerSymbol}`
    : undefined;
  const simpleIconLogo = simpleIcon
    ? proxiedVelmereLogo(`https://cdn.simpleicons.org/${simpleIcon}?viewbox=auto`)
    : undefined;

  // PASS4618 compatibility marker only: ? [providerImageLogo, trustedMappedLogo, apiProviderLogo, simpleIconLogo, identityImageLogo]
  // PASS4635 intentionally supersedes that remote-first order whenever a canonical local mark exists.
  const resolvedImageCandidates = unique(
    isCrypto
      // Local curated vector brand marks provide instant paint and zero network latency.
      // Remote provider images are reliable fallbacks for newly listed or secondary assets.
      ? [trustedMappedLogo, providerImageLogo, identityImageLogo, simpleIconLogo]
      : trustedMappedLogo
        // PASS4635: when a canonical local mark exists it is always the first paint authority.
        // Domain/API routes remain fallbacks, never a reason to flash a remote placeholder before Apple/Nvidia/etc.
        ? [trustedMappedLogo, providerImageLogo, simpleIconLogo, apiProviderLogo, identityImageLogo]
        : preferProviderBrand
          ? [providerImageLogo, simpleIconLogo, apiProviderLogo, identityImageLogo]
          : [providerImageLogo, simpleIconLogo, apiProviderLogo, identityImageLogo],
  );

  const imageCandidates = resolvedImageCandidates;

  return {
    symbol,
    glyph: resolvePass481Glyph(symbol),
    label: input.name || identity?.label || input.venue || symbol,
    tone:
      assetClass === "commodity"
        ? "commodity"
        : assetClass === "fx"
          ? "fx"
          : assetClass === "index"
            ? "index"
            : assetClass === "real_estate"
              ? "real-estate"
              : isExchange
                ? "exchange"
                : isCrypto
                  ? "crypto"
                  : "brand",
    imageCandidates,
  };
}

export function resolveVelmereExchangeLogo(venue: string) {
  return resolveVelmereAssetLogo({ symbol: venue, venue, name: venue, assetClass: "exchange" });
}

/* PASS476 compatibility coverage: KUCOIN · BITGET · TSLA · XAU/USD. Canonical identities now live in pass481-asset-identity-registry. */
