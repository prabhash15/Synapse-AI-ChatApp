from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from google import genai
from config import API_KEY

client = genai.Client(api_key = API_KEY)


app = FastAPI()
total_active_connections = set()

rooms = {}


origins = ["localhost:8000"]


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def get_answer(question):
    response = await asyncio.to_thread(client.models.generate_content , model="gemini-2.0-flash", contents=[question])
    return response.text


async def broadcast_total_users_in_room(room_number):
    for conn in rooms[room_number]:
        await conn.send_json({"type":"total_users","number":len(rooms[room_number])})


@app.websocket("/ws/chat")
async def chat_endpoint(websocket: WebSocket):

    await websocket.accept()

    
    userdetails = await websocket.receive_json()
    user_name = userdetails["user_name"]
    room_id = userdetails["room"]

    #clean the input
    user_name = user_name.strip().upper()

    #check if the room number is valid
    if room_id not in rooms:
        rooms[room_id] = set()
        rooms[room_id].add(websocket)
    else:
        rooms[room_id].add(websocket)

    await asyncio.to_thread(print,f"User {user_name} joined room {room_id}")

    await broadcast_total_users_in_room(room_id)

    #the total numbers of users all accross the rooms
    total_active_connections.add(websocket)

    try:
        while True:
            message = await websocket.receive_json()
            
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

            elif (message["type"] == "text" and "@ai" in message["message"]):
                AI_response = await get_answer(message["message"])
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
        for room in rooms:
            if websocket in rooms[room]:
                rooms[room].remove(websocket)
                await broadcast_total_users_in_room(room)


@app.get("/")
async def root():
    return {"message": "goto /ws/chat for chatting"}

