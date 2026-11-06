/** Export percentage is available glass on a 0–100 scale, never a ratio.
 * Decimal strings and BigInt preserve the exact result; approved policy rounds up.
 * This is an estimate only: never a report, union or physical receipt.
 */
export function exportGlassEstimate({quantity,percentage,present=true}={}) {
 const unavailable=reason=>({status:'UNAVAILABLE',reason,exact:null,rounded:null,rounding:null,integer:null,quantified:false});
 if(present!==true)return unavailable('EXPORT_NOT_CURRENT');
 if(quantity===null||quantity===undefined||percentage===null||percentage===undefined)return unavailable('MISSING_INPUT');
 const q=String(quantity),p=String(percentage);
 if(!/^\d{1,15}$/.test(q)||!/^\d{1,3}(?:\.\d{1,12})?$/.test(p))return unavailable('INVALID_INPUT');
 const [whole,decimal='']=p.split('.'),scale=10n**BigInt(decimal.length),percent=BigInt(whole)*scale+BigInt(decimal||'0');
 if(percent>100n*scale)return unavailable('PERCENTAGE_OUT_OF_RANGE');
 const numerator=BigInt(q)*(100n*scale-percent),denominator=100n*scale;
 const remainder=numerator%denominator,integer=remainder===0n;
 const fraction=integer?'':'.'+remainder.toString().padStart(decimal.length+2,'0').replace(/0+$/,'');
 return {status:'AVAILABLE',quantity:q,percentage:p,exact:(numerator/denominator).toString()+fraction,rounded:((numerator+denominator-1n)/denominator).toString(),rounding:'CEILING',integer,quantified:false};
}
