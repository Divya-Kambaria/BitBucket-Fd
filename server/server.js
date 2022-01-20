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
  onTicketCreateHandler: function(args) {
    $request.post(`https://api.bitbucket.org/2.0/repositories/${args.iparams.bitBucket_repo}/issues`,{
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
      }).then( data => {
        console.log('Successfully created the BitBucket issue for the freshdesk ticket');
        saveMapping({
          ticketID: args.data.ticket.id,
          issueID: data.response.id,
          issueUUID: data.response.reporter.uuid
        }).then( function success(){
          console.info('Successfully set the mapping in the db');
        },error =>{
          console.error('Error: Failed to set the mapping in the db');
          console.error(JSON.stringify(error));
        });
      },error => {
        console.error('Error: Failed to create the BitBucket issue for the freshdesk ticket');
        console.error(JSON.stringify(error));
      });
  },
  onTicketUpdateHandler: function(args){
   var priority_no = args.data.ticket.priority;
   let issue_priority = "trivial";
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
    issue_priority = priorityMap[`${priority_no}`];

   find(args.data.ticket.id).then( data => {
      const issueID = data.issue_data.issueID;
      $request.put(`https://api.bitbucket.org/2.0/repositories/${args.iparams.bitBucket_repo}/issues/${issueID}`,{
        headers: {
          Authorization : "Bearer <%= access_token %>"
        },
        isOAuth: true,
        json: {
          "priority" : issue_priority
        }

      }).then(() => {
        console.log("Successfully changed the issue priority");
      }, (error) => {
        console.error("Failed to update issue priority",JSON.stringify(error));
      })
      },error => {
        console.error("Error: couldn't able to find issue id",JSON.stringify(error));
        console.error(error);

      })
 },

  onConversationCreateHandler: function(args){
    const payload = typeof args.data === 'string' ? JSON.parse(args.data) : args.data;
    const ticketID = payload.conversation.ticket_id;
    find(ticketID).then( data => {
      const { issueID }= data.issue_data;
      $request.post(`https://api.bitbucket.org/2.0/repositories/${args.iparams.bitBucket_repo}/issues/${issueID}/comments`,{
        headers:{
          Authorization : " Bearer <%= access_token %>"
        },
        isOAuth: true,
        json:{
          "content":{
            "raw":`From ${payload.actor.name} - ${payload.conversation.body_text}`
          }
        }
      }).then( () => {
        console.log("Successfully added a comment in the issue");
      }, (error) => {
        console.error("Error: failed to add a comment in the issue",JSON.stringify(error));
      })

    },error => {
      console.error("Error : couldn't able to find issue id",JSON.stringify(error));
      console.error(error);
    })
  }


};
