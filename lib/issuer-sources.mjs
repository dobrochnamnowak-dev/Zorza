// Oficjalne domeny emitentów; nigdy nie zgadujemy domeny na podstawie nazwy.
// Identyfikatory odnoszą się do istniejącego katalogu właścicielki.
const companies={
 1:['nvidia.com'],2:['microsoft.com'],3:['broadcom.com'],4:['micron.com'],5:['amd.com'],6:['mastercard.com'],7:['oracle.com'],8:['appliedmaterials.com'],9:['lamresearch.com'],10:['gevernova.com'],11:['arista.com'],12:['kla.com'],13:['analog.com'],14:['amphenol.com'],15:['qualcomm.com'],16:['marvell.com'],17:['seagate.com'],18:['westerndigital.com','wdc.com'],19:['corning.com'],20:['vertiv.com'],21:['lumentum.com'],22:['ciena.com'],23:['ir.nu','nubank.com.br'],24:['everpuredata.com','purestorage.com'],25:['teradyne.com'],26:['coherent.com'],27:['netapp.com'],28:['eqt.com'],29:['united.com'],30:['flex.com'],31:['gf.com'],32:['lpl.com'],33:['affirm.com'],34:['ftaiaviation.com'],35:['firstsolar.com'],36:['toasttab.com'],37:['cnh.com','cnhindustrial.com'],38:['latticesemi.com'],39:['guidewire.com'],40:['semtech.com'],41:['qxo.com'],42:['chime.com'],43:['aa.com'],44:['forgentpower.com'],45:['formfactor.com'],46:['vicorpower.com'],47:['xpinc.com'],48:['mgic.com'],49:['mosaicco.com'],50:['auraminerals.com'],51:['ozk.com'],52:['lpcorp.com'],53:['howardhughes.com'],54:['schneider.com'],55:['westernunion.com'],
 56:['pmi.com'],57:['geaerospace.com'],58:['intel.com'],59:['shell.com'],60:['hsbc.com'],61:['paloaltonetworks.com'],62:['morganstanley.com'],63:['astrazeneca.com'],64:['sap.com'],65:['sap.com'],66:['roche.com'],67:['roche.com'],68:['pg.com'],69:['merck.com'],70:['unitedhealthgroup.com'],71:['bankofamerica.com'],72:['homedepot.com'],73:['novartis.com'],74:['novartis.com'],75:['asml.com'],76:['abbvie.com'],77:['costco.com'],78:['chevron.com'],79:['palantir.com'],80:['coca-colacompany.com'],81:['cisco.com'],82:['apple.com'],83:['abc.xyz','blog.google'],84:['abc.xyz','blog.google'],85:['aboutamazon.com'],86:['tsmc.com'],87:['tesla.com'],88:['meta.com','about.fb.com'],89:['lilly.com'],91:['walmart.com'],92:['jpmorganchase.com'],93:['berkshirehathaway.com'],94:['skhynix.com'],95:['exxonmobil.com'],96:['visa.com'],97:['jnj.com'],98:['asml.com'],99:['oerlikon.com'],100:['mph-ag.de'],101:['prospectstreet.com'],103:['take2games.com'],104:['veeva.com'],105:['humana.com']
};
const funds=[
 [/^WisdomTree/i,['wisdomtree.eu','wisdomtree.com']],
 [/^Vanguard/i,['vanguard.com','vanguard.co.uk','vanguard.eu']],
 [/^Amundi/i,['amundietf.com','amundi.com']],
 [/^Xtrackers/i,['etf.dws.com']],
 [/^iShares/i,['ishares.com','blackrock.com']],
 [/^UBS/i,['ubs.com']],
 [/^FlexShares/i,['flexshares.com','northerntrust.com']],
 [/^Invesco/i,['invesco.com']],
 [/^Franklin/i,['franklintempleton.com']],
 [/^JPMorgan/i,['am.jpmorgan.com']],
 [/^L&G/i,['lgim.com','am.landg.com']],
 [/^First Trust/i,['ftglobalportfolios.com','ftportfolios.com']],
 [/^Ossiam/i,['ossiam.com']]
];
export function issuerDomains(i){
 if(i.official_url){try{const u=new URL(i.official_url);if(u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&/^[a-z0-9.-]+\.[a-z]{2,}$/.test(u.hostname)&&!u.hostname.endsWith('.pl'))return [u.hostname];}catch{}}
 if(i.type==='etf')return funds.find(([pattern])=>pattern.test(i.name||i.name_on_screenshot||''))?.[1]||[];
 return companies[Number(i.id?.replace('AKCJA-',''))]||[];
}
