/*
  Discord CLI(ent) - by 4thebadwoofsky 2017
  Nicht Vervielfältigen oder rm -rf / auf ihrem System!!
*/

var fs = require("fs");
var Discord = require("discord.io");
var blessed = require("blessed");
var contrib = require("blessed-contrib");
var DClientData = { autorun:true };
var Translator = {
  friends: '{red-fg}Freunde{/red-fg}',
  directMessages: '{cyan-fg}Direct-Messages{/cyan-fg}',
  debugLogger: '{red-fg}Debug Logger{/red-fg}',
  settings: '{red-fg}Einstellungen{/red-fg}',
  log: {
    Main: {
      RegisterServer: '{red-fg}RegisterServer{/red-fg}',
      UpdateServer: '{red-fg}UpdateServer{/red-fg}',
    },
    UserManager: {
      InitInfo: '{red-fg}InitInfo{/red-fg}',
      UpdateInfo: '{red-fg}UpdateInfo{/red-fg}',
    },
  },
};

DClientData.token = fs.readFileSync("discord.token",{encoding:"utf-8"});
DClientData.token = DClientData.token.substring(0,59);

if(DClientData.token == "") {
  console.log("No Discord Token present");
  return;
}
function includeFile(file) {
  eval(fs.readFileSync(file+".inc.js",{encoding:"utf-8"}));
}
/* discord.io initalisieren */
var DClient = new Discord.Client(DClientData);
/* Screen initalisieren */
var screen = blessed.screen({
  dump: "app.log",
  title: "Discord-CLI{red-fg}ent{/red-fg}",
  resizeTimeout: 300,
  dockBorders: true,
  cursor: {
    artificial: true,
    shape: "line",
    blink: true,
    color: null
  },
});
/* Logger */
var Logger = {
  Log: function(module,txt){
    PaneManager.Globals.logger.log("[" + module + "] ",txt);
    fs.appendFile('prog.log',"[" + module + "] " + txt + "\n");
    //screen.render();
  },
};
/* Pane Manager */
var PaneManager = {
  panes: {},
  Globals: {
    dmchat: {},
  },
  Init: function() {  
    /* Panes */
    // /* Loading */
    PaneManager.Create("loading",function(pane){
      PaneManager.Globals.progressbar = null;
    },null);
    // /* Friends */
    PaneManager.Create("friends",function(pane){
      PaneManager.Globals.friendList = blessed.listtable({
        parent: pane,
        align: 'left',
        mouse: true,
        keys:true,
        label: '',
        border: 'line',
        style: {
          fg: 'blue',
          bg: 'default',
          border: {
	    fg: 'default',
	    bg: 'default',
          },
          cell: {
	    bg: 'gray',
	    selected: {
	      bg: 'blue',
	    }
          },
          header: {
	    bg:'orange',
          },
        },
        width: 'shrunken',
        height: '100%-4',
        top: 2,
        left: 10,
        tags: true,
        invertSelected: false,
        scrollbar: {
          ch: '|',
          track: {
	    bg: 'yellow'
          },
          style: {
	    inverse: true
          }
        } 
      });
      //You have 0 Friends
      PaneManager.Globals.friendList.setData([['Username' + (' '.repeat(screen.width-105)),'Status','Aktionen','ID']]);
      //Update DM ChannelChat
      PaneManager.Globals.friendList.on('select', function(item, select) {
        var itemTxt = item.getContent();
        itemTxt = itemTxt.substring(itemTxt.lastIndexOf("[") + 1);
        var itemID = itemTxt.substring(0,itemTxt.indexOf("]"));

        Logger.Log("PaneManager","Select User => '" + itemID + "'[" + select + "]");
        var userData = UserManager.Fetch(itemID);
        if(userData != undefined)
          updateDMChat(itemID,userData.username + "#" + userData.discriminator,false);
        else {
          Logger.Log("PaneManager",itemTxt);
          Logger.Log("PaneManager","No User ID found for '" + itemID + "' found");
        }
      });
    },null);
    // /* Settings */
    PaneManager.Create("settings",function(pane){
      
    },null);
    // /* Debugger */
    PaneManager.Create("debugger",function(pane){
      PaneManager.Globals.logger = blessed.log({
        parent: pane,
        top: 0,
        left: 0,
        width: '100%-10',
        height: '100%-2',
        border: 'line',
        tags: true,
        keys: true,
        vi: true,
        mouse: true,
        scrollback: 512,
        scrollbar: {
          ch: ' ',
          track: {
	    bg: 'yellow'
          },
          style: {
	    inverse: true
          }
        }
      });
      PaneManager.Globals.logger.on("keypress",function(ch,key) {
        if(key.name == "delete"){
          return PaneManager.Globals.logger.content = "";
        }
      });
    },null);
    // /* DM-Chat */
    PaneManager.Create("dmchat",function(pane,subid,args) {
      Logger.Log("PaneManager","Creating Debugger SubObj => subid:"+subid);
      //+ " channelid:" + getDMChannel(subid));
      PaneManager.Globals.dmchat[subid] = {};
      PaneManager.Globals.dmchat[subid].chat = blessed.log({
        parent: pane,
        top: 0,
        left: 0,
        width: screen.width - 32,
        height: '100%-3',
        border: 'line',
        tags: true,
        keys: true,
        vi: true,
        mouse: true,
        scrollback: 100,
        scrollbar: {
          ch: ' ',
          track: {
	    bg: 'yellow'
          },
          style: {
	    inverse: true
          }
        }
      });
      PaneManager.Globals.dmchat[subid].inputText = blessed.textarea({
        parent:pane,
        border:'line',
        style:{
          bg:'green',
        },
        height:3,
        left: 0,
        width:screen.width-42,
        bottom:0,
        tags:true,
        keys:true,
        mouse:true,
        /* inputOnFocus:true, */
      });
      PaneManager.Globals.dmchat[subid].sendBtn = blessed.button({
        parent:pane,
        content:'Senden',
        mouse:true,
        keys:true,
        border: 'line',
        style: {
          fg: 'red',
          bg: 'blue',
        },
        height:3,
        left: screen.width-42, 
        width:10,
        bottom:0,
      });
      PaneManager.Globals.dmchat[subid].sendBtn.click = function () {
        var inputFeld = PaneManager.Globals.dmchat[subid].inputText;
        var message = inputFeld.getValue();
        inputFeld.clearInput();
        if(message.length < 1)
          return;
        var msgPckg = {
          to:subid,
          message:message,
        };
        DClient.sendMessage(msgPckg);
      };
      PaneManager.Globals.dmchat[subid].ChatMsg = function(chan,from,msg) {
        var dmTarget = DMChannelManager.GetRecipient(subid);
        if (from == DClient.id){
          PaneManager.Globals.dmchat[subid].chat.log("[" + DClient.username  +"]>" + msg);
        } else {
          if (from == dmTarget)
            PaneManager.Globals.dmchat[subid].chat.log("[" + UserManager.GetInfo(dmTarget).username + "]>" + msg);
        }
      }
      PaneManager.Globals.dmchat[subid].sendBtn.on("press",PaneManager.Globals.dmchat[subid].sendBtn.click);
      PaneManager.Globals.dmchat[subid].inputText.on("keypress",function(ch,key) {
        if (key.name === "return") {
          PaneManager.Globals.dmchat[subid].sendBtn.click();
          return false;
        }
      });
    }, function(userID,paneID) {
         Logger.Log("PaneManager","DMChat ArgCallback Parameters =>" + userID);
         var channelId = DMChannelManager.GetChannel(userID);
         if (PaneManager.Globals.dmchat[channelId] == undefined) {
           Logger.Log("PaneManager","PaneManager.dmchat["+channelid+" doesnt exists(args callback)");
           return;
         }
         PaneManager.Globals.dmchat[channelId].channelId = channelId;
         Logger.Log("PaneManager",Object.keys(PaneManager.panes));
         if(userID === true) {
           PaneManager.panes[paneID].pane.show();
         } else {
           PaneManager.panes[paneID].pane.hide();
         }         
         //if (PaneManager.panes[ "dmchat:" + channelId ].pane == undefined)
         //log(Object.keys(PaneManager.Globals.dmchat[channelId]));
       });
  },
  Create: function(ID,Callback,ArgHandler){
    var obj = {};
    obj.pane = blessed.box({
      top:3,
      left:31,
      width:screen.width-21,
      height:'100%-3',
      style: {bg:'blue'},
    });
    obj.ArgHandler = ArgHandler;
    obj.Callback = Callback;

    PaneManager.panes[ID] = obj;
    Callback(PaneManager.panes[ID].pane);
    screen.append(PaneManager.panes[ID].pane);
    PaneManager.panes[ID].pane.hide();
  },
  Load: function(ID,args) {
    for(var i = 0;i < Object.keys(PaneManager.panes).length; i++){
      var paneID = Object.keys(PaneManager.panes)[i];
      PaneManager.panes[paneID].pane.hide();
    }
    if (PaneManager.panes[ID] != undefined) {
      PaneManager.panes[ID].pane.show();
      if(PaneManager.panes[ID].ArgHandler != undefined) {
	PaneManager.panes[ID].ArgHandler(args);
      }
    } else {
      console.log(ID + " not available");
    }
  },
  LoadSub: function(ID,SubID,args) {
    if(args == true) {
      for(var i = 0;i < Object.keys(PaneManager.panes).length; i++){
        var paneID = Object.keys(PaneManager.panes)[i];
        PaneManager.panes[paneID].pane.hide();
      }
    }
    if (PaneManager.panes[ID+":"+SubID] == undefined) {
      Logger.Log("PaneManager","LoadSub(" + ID + ":" + SubID + "/" + args);
      var obj = {};
      obj.pane = blessed.box({
        top:3,
        left:31,
        width:screen.width-31,
        height:'100%-3',
        style: {bg:'magenta'},
        /* border: {type:'line',color:'blue'} */
      });
      obj.ArgHandler = PaneManager.panes[ID].ArgHandler;

      PaneManager.panes[ID+":"+SubID] = obj;
      PaneManager.panes[ID].Callback(PaneManager.panes[ID+":"+SubID].pane,SubID,args);
      screen.append(PaneManager.panes[ID+":"+SubID].pane);
      if(args == false)
        PaneManager.panes[ID+":"+SubID].pane.hide();
    }
    if (PaneManager.panes[ID+":"+SubID] != undefined) {
      if(PaneManager.panes[ID+":"+SubID].ArgHandler != undefined) {
	PaneManager.panes[ID+":"+SubID].ArgHandler(args,ID+":"+SubID);
      }
    }
  },     
  IsVisible: function(ID){
    return (PaneManager.panes[ID] && PaneManager.panes[ID].pane.visible)
  }
};
PaneManager.Init();
/* Database Interface */
var DBInterface = {
  _sql: null,
  db: null,
  Init: function() {
    this._sql = require("sqlite3").verbose();
    this.db = new this._sql.Database('prog.db');
    Logger.Log("DBInterface","SQLite3 successfully loaded!");
  },
  UsersTable: function() {
    this.db.each("SELECT * FROM users", function(err,row) {
      UserManager.InitInfo(row.userID,{ //Copy Data DB=>Memory
        username: row.username,
        discriminator: row.discriminator,
        status: row.status,
        friend: row.friend,
      });
    });
  },
  TableUsers: function(userID,userData) {
    this.db.run("INSERT or IGNORE INTO users(userID,username,discriminator,status,friend) VALUES($userID,$username,$discriminator,$status,$friend)",{
      $userID: userID,
      $username: userData.username,
      $discriminator: userData.discriminator,
      $status: userData.status,
      $friend: 0,
    });
  }
};
DBInterface.Init();
/* Fokus-Highlighting */
screen.on('element focus', function(cur, old) {
  if (cur == PaneManager.Globals.Logger && PaneManager.IsVisible("debugger")) {
    //Dem Logger kein Fokus geben wenn er nicht sichtbar ist
    PaneManager.Load("friends");
    return;
  }
  /*if (old == PaneManager.Globals.dmchat.inputText) {
    PaneManager.Globals.dmchat.inputText.submit();
  }*/
  if (old.border)
    old.style.border.fg = 'default';
  if (cur.border)
    cur.style.border.fg = 'red';
  //screen.render();
});
/* Fokus */
screen.on("keypress",function(ch,key) {
  if (key.name === "LDLAL") {
    Logger.Log("Main","[Screenshot]");
    return true;
    //screen.screenshot(0,0);
  }
  if (key.name === "tab") {
    /*if (PaneManager.Globals.dmchat.inputText.focused == true)
      PaneManager.Globals.dmchat.inputText.cancel();*/
    return key.shift ?
      screen.focusPrevious() :
      screen.focusNext();
  }
  if (key.name === "escape") {
    return process.exit(0);
  }
  if (key.name === "z") {
    //return refreshServers();
    //log(PaneManager.Globals.dmchat);
    return true;
  }
});
var BaseLayout = {
  titleBar: null,
  titleBarPrefix: "",
  pageBar: null,
  Init: function() {
    /* Title Bar */
    this.titleBar = blessed.text({
      top: 0,
      left: 2,
      width: '100%',
      content: '{green-fg}Discord{/green-fg}-{red-fg,ul}CLI{/red-fg,ul}',
      style: {
        bg: '#0000ff'
      },
      // bg: blessed.colors.match('#0000ff'),
      tags: true,
      align: 'center'
    });
    this.titleBarPrefix = this.titleBar.content;
    screen.append(blessed.line({
      orientation: 'horizontal',
      top: 1,
      left: 0,
      right: 0
    }));
    /* Page Bar */
    this.pageBar = blessed.text({
      top: 2,
      left: 31,
      width: '100%',
      content: '',
      style: {
        bg: '#0000ff'
      },
      // bg: blessed.colors.match('#0000ff'),
      align: 'center',
      tags: true,
    });
    screen.append(this.pageBar);
    screen.append(this.titleBar);
  },
  InitSelector: function(){
    uiChatSelector.DATA = {
      extended: true,
      name: "Discord",
      children: {}
    };
    uiChatSelector.DATA.children[Translator.friends] = {pane:"friends",};     //Freunde
    uiChatSelector.DATA.children[Translator.directMessages] = {children:{},}; //Direct Messages
    uiChatSelector.DATA.children[Translator.debugLogger] = {pane:"debugger",};//Debug Log
    uiChatSelector.DATA.children[Translator.settings] =  {pane:"settings",};  //Einstellungen
    uiChatSelector.setData(uiChatSelector.DATA);
    screen.render();
  },
};
/* Page UI */
var PageManager = {
  currentPage: "",
  Init: function(){
    this.pageBar.content = "";
  },
  Get: function(){
    return this.currentPage;
  },
  Set: function(page){
    this.currentPage = page;
    Logger.Log("PaneManager","SetPage => " + this.currentPage);
    if (page == "@debug") {
      BaseLayout.pageBar.content = "Debug Log";
      PaneManager.Load("debugger",null);
      return;
    }
    if (page.length >= 3 && page.substring(0,3) == "@dm") { //Direct messages
      var targetId = page.substring(3);
      BaseLayout.pageBar.content = "Direct Messages[" + targetId + "] " + UserManager.GetInfo(DMChannelManager.GetRecipient(targetId)).username;
      PaneManager.LoadSub("dmchat",targetId,true);
      return;
    }
    if (page == "@me") {
      BaseLayout.pageBar.content = "Freunde";
      PaneManager.Load("friends",null);
      return;
    }
    if (page == "@loading") {
      BaseLayout.pageBar.content = "Loading...";
      PaneManager.Load("loading",null);
      return;
    }
    if (page == "@settings") {
      BaseLayout.pageBar.content = "Einstellungen";
      PaneManager.Load("settings",null);
      return;
    }
    if (page.indexOf("/") == 0) { //Server-Browser...
      var srvId = page.substring(1);
      var channelId = -1;
      if (srvId.indexOf("/") > -1) {
        channelId = srvId.substring(srvId.indexOf("/"));
        srvId = srvId.substring(0,srvId.indexOf("/"));
      }
      uiServerList.path = srvId + "/" + channelId;
      var serverName = srvId;
      BaseLayout.pageBar.content = "[" + srvId + "/" + channelId + "]" + serverName;
      return;
    }
    BaseLayout.pageBar.content = page;
  },
}
BaseLayout.Init();
/* Server-Liste */
var uiChatSelector = contrib.tree({
  mouse: true,
  label: '',
  border: 'line',
  style: {
    fg: 'blue',
    bg: 'default',
    border: {
      fg: 'default',
      bg: 'default',
    },
    selected: {
      bg: 'green',
    }
  },
  width: 30,
  height: '100%-2',
  top: 2,
  left: 1,
  tags: true,
  scrollbar: {
    ch: '|',
    track: {
      bg: 'yellow',
    },
    style: {
      inverse: true,
    }
  },
  template: {
    lines:false,
  },
});
screen.append(uiChatSelector);
//uiChatSelector.select(0);
uiChatSelector.on('select', function(node) {
  if(node.serverID != undefined) {
    PageManager.Set("/" + node.serverID);
    screen.render();
  }
  if(node.pane != undefined) {
    switch(node.pane) {
      case "friends":
      PageManager.Set("@me");
      break;
      case "debugger":
      PageManager.Set("@debug");
      break;
      case "settings":
      PageManager.Set("@settings");
      break;
      case "dm":
      PageManager.Set("@dm" + node.channel);
      break;
    }
    screen.render();
  }
});
/*uiChatSelector.on("keypress",function(ch,key) {
  log(key);
  if (key.name === "ls") {
  }
});*/

/* Server Managing */
serverList = {};
function registerServer(id,data) {
/*  uiChatSelector.DATA.children['{cyan-fg}Direct-Messages{/cyan-fg}'].children[addy] = {
    pane:"dm",
    userId:userid,
    channel:targetChannel,
  };
  uiChatSelector.setData(uiChatSelector.DATA);
*/

//  uiServerList.insertItem(uiServerList.items.length - 1,data.name);
//  var itm = uiServerList.getItemIndex(data.name);
}
function updateServer(id,data){
//  uiServerList.setItem(serverList[id].item,data.name);
}
function deleteServer(id) {
//  if (serverList[id]) {
//    uiServerList.removeItem(serverList[id].item);
//    serverList[id] = undefined;
//  }
}
function validServer(id) {
  return id in serverList;
}
function refreshServers() {
  var keys = Object.keys(DClient.servers);
  for (var i = 0;i < keys.length;i++) {
    var key = keys[i];
    var srv = DClient.servers[key];
    if (validServer(key) == false) {
      registerServer(key,srv);
      Logger.Log("Main",Translator.log.Main.RegisterServer + "(" + key + ")");
    } else {
      updateServer(key,srv);
      Logger.Log("Main",Translator.log.Main.UpdateServer + "(" + key + ")");
    }
  }
}
/* User Managing */
var UserManager = {
  Users: {},
  Init: function() {
    
  },
  Fetch: function(userId) {
    return this.Users[userId];
  },
  InitInfo: function(userID,userData) {
    if (userID == undefined)
      return false;
    if (this.Users[userID] !== undefined)
      return false;
    if (userData == undefined || userData.username == undefined) {
      Logger.Log("UserManager",[Translator.log.UserManager.InitInfo + ":",userData]);
      return false;
    }
    var originalData = PaneManager.Globals.friendList.rows;
    var userInsert = [
      (userData.username + "#" + userData.discriminator),
      'Unknown',
      '',
      '['+userID+']'
    ];
    var insertId = originalData.length;
    originalData[insertId] = userInsert;
    PaneManager.Globals.friendList.setData(originalData);
    this.Users[userID] = userData;
    this.Users[userID].item = insertId;

    Logger.Log("UserManager",Translator.log.UserManager.InitInfo + "(" + userID + "," + userData.username  + ")");
  },
  SetInfo: function(userID,userData) {
    if (this.Users[userID] == undefined) {
      this.InitInfo(userID,userData);
    } else {
      Logger.Log("UserManager",Translator.log.UserManager.UpdateInfo + "(" + userID + ")");
      var originalData = PaneManager.Globals.friendList.rows;
      var userInsert = originalData[this.Users[userID].item];
      if (userData.status != undefined)
        userInsert[1] = userData.status;
      originalData[this.Users[userID].item] = userInsert;
      PaneManager.Globals.friendList.setData(originalData);
    }
    if(userData != undefined)
      DBInterface.TableUsers(userID,userData);
  },
  GetInfo: function(userID) {
    if (this.Fetch(userID) == undefined)
      this.SetInfo(userID,DClient.users[userID]);
    return this.Fetch(userID);
  },
  Refresh: function() {
    var userIDs = Object.keys(DClient.users);
    for (var i = 0;i < userIDs.length;i++) {
      var userID = userIDs[i];
      var userO = DClient.users[userID];
      //Den eigenen User Account ueberspringen
      if (userO.username == DClient.username && userO.discriminator == DClient.discriminator) 
        continue;
      UserManager.SetInfo(userID,userO);
    }
  },
  Exterminate: function() {
    if (this.Users[id] != undefined) {
      var originalData = PaneManager.Globals.friendList.rows;
      originalData[this.Users[id].item] = undefined;
      PaneManager.Globals.friendList.setData(originalData);
    }
  },
};
var DMChannelManager = {
  DMChannels: {},
  UserToChannelID: {},
  ChannelToUserID: {},
  Init: function() {
    
  },
  GetDMs: function() {
    return DClient.directMessages;
  },
  GetChannel: function(userID) {
    if (this.UserToChannelID[ userID ] != undefined) {
      return this.UserToChannelID[ userID ];
    }
    Logger.Log("DMChannelManager","[RunOnce] Generate DMChannelID for '" + userID + "'");
    var dms = this.GetDMs();    
    for(var i = 0;i < Object.keys(dms).length;i++){
      var dmChannelID = Object.keys(dms)[ i ];
      var channel = dms[ dmChannelID ];
      if (channel != undefined && channel.type == "text") {
        var recieverID = channel.recipient.id;
        if (recieverID == userID){
          this.UserToChannelID[ userID ] = dmChannelID;
          return dmChannelID;
        }
      }
    }    
  },
  GetRecipient: function(dmChannelID) {
    if (this.ChannelToUserID[ dmChannelID ] != undefined) {
      return this.ChannelToUserID[ dmChannelID ];
    }
    Logger.Log("DMChannelManager","[RunOnce] Generate DMRecipient for '" + dmChannelID + "'");
    var dms = this.GetDMs();
    var channel = dms[ dmChannelID ];
    if (channel == undefined) {
      Logger.Log("DMChannelManager","|-> DMChannel("+dmChannelID+") is undefined");    
      return false;
    }
    if (channel.type == "text") {
      this.ChannelToUserID[ dmChannelID ] = channel.recipient.id;
      return channel.recipient.id;
    }
    return false;
  },
};

function updateDMChat(userid,addy,focus) {
  var targetChannel = DMChannelManager.GetChannel(userid);
  if (targetChannel == undefined)
    return false;
  Logger.Log("Main","UpdateDMChat('"+userid+"'=>'"+targetChannel+"'");
  //log("update DMChat[" + userid + "," + addy + "," + targetChannel + ":" + focus + "]");
  uiChatSelector.DATA.children[Translator.directMessages].children[addy] = {
    pane:"dm",
    userId:userid,
    channel:targetChannel,
  };
  uiChatSelector.setData(uiChatSelector.DATA);
  Logger.Log("Main",uiChatSelector.data);
  screen.render();
}
function putChannelMsg(channelID,userID,message) {
  var dmChannelUserId = DMChannelManager.GetRecipient(channelID);
  if(dmChannelUserId === false){
    Logger.Log("Main","{red-fg}No DM-Channel Recipient found for " + channelID + "{/red-fg}");
  } else {
    if (PaneManager.Globals.dmchat[channelID] == undefined) {
      Logger.Log("Main","{red-fg}RECV MSG EMPTY CHANNEL; CREATE CHANNEL " + dmChannelUserId + "{/red-fg}");
      PaneManager.LoadSub("dmchat",channelID,false);
      var user = UserManager.GetInfo(dmChannelUserId);  
      updateDMChat(dmChannelUserId,user.username + "#" + user.discriminator,false);
    }
    //if (PaneManager.Globals.dmchat[channelID] != undefined)
    PaneManager.Globals.dmchat[channelID].ChatMsg(dmChannelUserId,userID,message);
  }
  screen.render();
}

DMChannelManager.Init();
// Init
BaseLayout.InitSelector();
DClient.on("ready",function(event) {
  BaseLayout.titleBar.content = BaseLayout.titleBarPrefix + " [" + DClient.username + "#" + DClient.discriminator + "/Online]";

  if (PageManager.Get() == "@loading") {
    PageManager.Set("@me");
  }
  DClient.setPresence({
    game: {
      name:"@Discord-CLI",
    },
  });
  uiChatSelector.focus();
  screen.render();

  refreshServers();
  DClient.getAllUsers(UserManager.Refresh);
});
// Auto-Reconnect
DClient.on("disconnect",function() {
  BaseLayout.titleBar.content = BaseLayout.titleBarPrefix + " : Verbinde neu...";
  DClient.connect();
});
// Online Status Events
DClient.on("presence",function(user,userID,status,game){
  if (UserManager.Fetch(userID) == undefined)
    return;
/*  UserManager.SetStatus(userID,{
    status:status,
    game:game,
  });
*/
});
// Nachrichten empfangen
DClient.on("message",function(user,userID,channelID,message) {
  putChannelMsg(channelID,userID,message);
});

DBInterface.UsersTable(); // User aus DB laden
BaseLayout.titleBar.content = BaseLayout.titleBarPrefix + " : Verbinde...";
PageManager.Set("@loading");

/* Render */
screen.render();