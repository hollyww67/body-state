import {getRedis} from './redis';
import {validBookingId,type JourneyService} from '@/lib/booking-journey';

/** Both authorized client entry points share one quota for the same booking. */
const localCounters=new Map<string,{count:number;expires:number}>();
export async function checkBookingRescheduleLimit(service:JourneyService,id:string) {
  if(!validBookingId(id))return false;
  const key=`rate-limit:booking-reschedule:booking:${service}:${id.toLowerCase()}`;
  const redis=await getRedis();
  if(redis) {
    const count=await redis.eval(`local n=redis.call('INCR',KEYS[1]); if n==1 or redis.call('TTL',KEYS[1])==-1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n`,{keys:[key],arguments:['900']});
    return Number(count)<=12;
  }
  if(process.env.NODE_ENV==='production')throw Error('Reschedule quota requires Redis');
  // A synchronous critical section after the await: no lost increments in the
  // supported single-process development fallback. Production never uses it.
  const now=Date.now(),old=localCounters.get(key);
  const entry=old&&old.expires>now?old:{count:0,expires:now+900_000};
  entry.count++;localCounters.set(key,entry);
  if(localCounters.size>10_000)for(const [k,v] of localCounters)if(v.expires<=now)localCounters.delete(k);
  return entry.count<=12;
}
