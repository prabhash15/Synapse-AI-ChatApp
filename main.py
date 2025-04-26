from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from google import genai
from config import API_KEY
from URoomNumber import generate_unique_room_id
from music import download

import base64

client = genai.Client(api_key = API_KEY)

query = """Format the following content using ONLY the specified HTML tags and formatting rules:

1. Use HTML heading tags <h1> to <h6> ONLY for headings.
2. Wrap regular text content inside <p> tags.
3. Use <code> ONLY for code blocks (marked by triple backticks ```).
4. DO NOT use any other HTML tags.
5. Where necessary, apply bold + italics + underline formatting to emphasize key text (using: bold + italics + underline at the same time).
6. Do not include any text outside the formatted HTML output. Just return the converted HTML code only.

Here is the content to format:
"""

app = FastAPI()
total_active_connections = set()

rooms = {}
ws_username = {}

origins = ["localhost:8000"]


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
async def valid_room(rooms , room_id):
    if room_id in rooms:
        return True

async def get_answer(question):
    response = await asyncio.to_thread(client.models.generate_content , model="gemini-2.0-flash", contents=[question])
    return response.text


async def broadcast_total_users_in_room(room_number , user_name = None , remove_user = None):
    if user_name and not remove_user:
        for conn in rooms[room_number]:
            await conn.send_json({"type":"joined","user_name":user_name})
            
    elif remove_user and remove_user:
        for conn in rooms[room_number]:
            await conn.send_json({"type":"left","user_name":user_name})
        
    for conn in rooms[room_number]:
        await conn.send_json({"type":"total_users","number":len(rooms[room_number])})


@app.websocket("/ws/chat")
async def chat_endpoint(websocket: WebSocket):

    await websocket.accept()

    room_id = None
    user_name = None
    
    create_or_join = await websocket.receive_json()
                
    
    
    if create_or_join["type"] == "create_room":
        
        room_id = await generate_unique_room_id(rooms)
        
        #create the room id that was generated above and add the requesting websocket to the room
        rooms[room_id] = set()
        rooms[room_id].add(websocket)
        
        #send the room id to the client
        await websocket.send_json(
            {"type": "room_created", 
             "room_id": room_id}
            )

    if create_or_join["type"] == "join":
        
        user_name = create_or_join["user_name"]
        room_id = create_or_join["room"]
        isValid= await valid_room(rooms , room_id)
        
        if isValid:
            rooms[room_id].add(websocket)
            # add the username to the websocket:user_name dictionary
            ws_username[websocket] = user_name  
            await broadcast_total_users_in_room(room_id , user_name)
            
        else: 
            await asyncio.to_thread(print,f"Room {room_id} does not exist")
        
            
        
    await asyncio.to_thread(print,f"Rooms: {rooms}")
     

    #the total numbers of users all accross the rooms
    total_active_connections.add(websocket)

    try:
        while True:
            
            #recieve any new messages from the client of any type
            message = await websocket.receive_json()
            
            if message["type"] == "join":
                
                user_name = message["user_name"]
                room_id = message["room"] 
                
                #check if the room number is valid
                
                isValid = await valid_room(rooms , room_id)
                
                if not isValid:
                    await asyncio.to_thread(print,f"Room {room_id} does not exist")
                
                #printing the user name and room id in the console
                await asyncio.to_thread(print, f"User {user_name} in room {room_id} joined")
                
                # add the username to the websocket:user_name dictionary
                ws_username[websocket] = user_name
                
                await broadcast_total_users_in_room(room_id , user_name)
            
            if message["type"] == "image":
                await asyncio.to_thread(print, f"User {user_name} in room {room_id} sent an image")
                
                img_data = bytes(message["data"])
                file_type = message["fileType"]
                filename = message["filename"]
                user_name = message["user_name"]
                
                if websocket in rooms[room_id]:
                    for conn in rooms[room_id]:
                        
                        if conn != websocket:
                            await conn.send_json({
                            "type": "image",
                            "data": list(img_data),
                            "fileType": file_type,
                            "filename": filename,
                            "user_name": user_name
                            })

            if (message["type"] == "text" and "@ai" in message["message"]):
                AI_response = await get_answer(message["message"] + query)
                
                #cleaning the response
                AI_response = AI_response.replace("```html","")
                AI_response = AI_response.replace("```","")
                
                await asyncio.to_thread(print,f"AI response: {AI_response}")
                if websocket in rooms[room_id]:
                    for conn in rooms[room_id]:
                        if conn != websocket:
                            
                            await conn.send_json(
                                {"type":"message",
                                 "user_name":f"{user_name}",
                                 "message":f"{message["message"]}"
                                 })
                            
                        await conn.send_json(
                                             {"type":"message",
                                              "user_name":"AI",
                                              "message":f"{AI_response}"
                                              })
            
            
            if message["type"] == "youtube_link":
                
                audio = await download(message["url"])
                base64_data = base64.b64encode(audio["data"]).decode("utf-8")
                for conn in rooms[room_id]:
                    await conn.send_json({"type":"audio","audio_data":base64_data})
                    
                
                        
            else:
                if websocket in rooms[room_id]:
                    for conn in rooms[room_id]:
                        if conn != websocket:
                            
                            await conn.send_json(
                                {"type":"message",
                                 "user_name":f"{user_name}",
                                 "message":f"{message["message"]}"
                                 })


    except WebSocketDisconnect:
        await asyncio.to_thread(print,f"User {user_name} left room {room_id}")
        total_active_connections.remove(websocket)
        for room_id in rooms:
            if websocket in rooms[room_id]:
                rooms[room_id].remove(websocket)
                await broadcast_total_users_in_room(room_id , ws_username[websocket] , True )
                
        if len(rooms[room_id]) == 0:
            del rooms[room_id]
        await asyncio.to_thread(print,f"Rooms: {rooms}")


@app.get("/")
async def root():
    return {"message": "goto /ws/chat for chatting"}

