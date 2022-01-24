function saveMapping(data){
  var dbKey1 = String(`fdTicket:${data.ticketID}`).substr(0,30);
  // dbKey2 is used when ticketId is needed using issueID
  var dbKey2 = String(`bitbucketIssue:${data.issueID}`).substr(0,30);
  return Promise.all([$db.set(dbKey1, { issue_data: data }), $db.set(dbKey2, { issue_data: data })])
}
function find(ticketID){
  var dbKey = String(`fdTicket:${ticketID}`)
  return $db.get(dbKey);
}

exports = {
  onTicketCreateHandler: async function(args) {
    try {
      const data = await $request.post(`https://api.bitbucket.org/2.0/repositories/${args.iparams.bitBucket_repo}/issues`,{
        headers:{
          Authorization: 'Bearer <%= access_token %>',
          content_type:' application/json'
        },
        isOAuth: true,
        json: {
           title: args.data.ticket.subject,
           content: {
            raw: args.data.ticket.description_text
           }
        }
      })

       if(data.status !== 201 ) throw new Error("Error: Failed to create the BitBucket issue for the freshdesk ticket");
       console.log('Successfully created the BitBucket issue for the freshdesk ticket');
       const storeDataStatus =  await saveMapping({
        ticketID: args.data.ticket.id,
        issueID: data.response.id,
        issueUUID: data.response.reporter.uuid
      });

      if(!storeDataStatus[0].Created && !storeDataStatus[1].Created) throw new Error("Error: Failed to set the mapping in the db");
      console.info('Successfully set the mapping in the db');


    } catch(error){
      console.error(error.message);
    }


  },
  onTicketUpdateHandler: async function(args){
   const priority_no = args.data.ticket.priority;
  //  if(priority_no === 1) issue_priority = "minor";
  //  else if(priority_no === 2) issue_priority = "major";
  //  else if(priority_no === 3) issue_priority = "critical";
  //  else if(priority_no === 4) issue_priority = "blocker";

    const priorityMap = {
        1 : 'minor',
        2 : 'major',
        3 : 'critical',
        4 : 'blocker'
    }
   const issue_priority = priorityMap[priority_no] || 'trivial';

    try {
        const data = await find(args.data.ticket.id)
        if(!data) throw new Error(`Error: couldn't able to find issue id, ${data}`);
        const { issueID } = data.issue_data;
        const res = await $request.put(`https://api.bitbucket.org/2.0/repositories/${args.iparams.bitBucket_repo}/issues/${issueID}`,{
          headers: {
            Authorization : "Bearer <%= access_token %>"
          },
          isOAuth: true,
          json: {
            "priority" : issue_priority
          }

        })
        if(res.status !== 200) throw new Error(`Error: Failed to update issue priority,${res.status}`);

        console.log('Successfully changed the issue priority');

      } catch(error){
      console.error(error.message);
    }
 },

  onConversationCreateHandler: async function(args){
    const payload = typeof args.data === 'string' ? JSON.parse(args.data) : args.data;
    const ticketID = payload.conversation.ticket_id;

    try{
      const data = await find(ticketID);
      if(!data) throw new Error(`Error: couldn't able to find issue id, ${data}`);
      const { issueID }= data.issue_data;
      const res = await $request.post(`https://api.bitbucket.org/2.0/repositories/${args.iparams.bitBucket_repo}/issues/${issueID}/comments`,{
        headers:{
          Authorization : " Bearer <%= access_token %>"
        },
        isOAuth: true,
        json:{
          "content":{
            "raw":`From ${payload.actor.name} - ${payload.conversation.body_text}`
          }
        }
      })
      if(res.status !== 201) throw new Error(`Error: failed to add a comment in the issue,${res.status}`);
      console.log("Successfully added a comment in the issue");


    } catch (error) {
      console.error(`${error.message}`);
    }
  }


};
