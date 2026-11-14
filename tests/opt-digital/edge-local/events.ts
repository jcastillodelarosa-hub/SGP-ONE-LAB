const events=new EventManager();
for await(const event of events){if(event.event_type!=='Log')console.log(JSON.stringify({workerEvent:event}));}
