## Authentication APIs

### Signup

#### Endpoint: POST {{base_URL}}/apiv1/auth/signup

#### Request Body:
```json
{
    "name": "John Doe",
    "email": "johndoe@example.com",
    "password": "SecurePass@123",
    "confirmPassword": "SecurePass@123",
    "accountType": "Student"
}
```

#### Response:
```json
{
    "success": true,
    "user": {
        "name": "John Doe",
        "email": "johndoe@example.com",
        "password": "$2b$10$hashedpasswordstring",
        "accountType": "Student",
        "_id": "60f7c9e4a8194502b1e6abc",
        "createdAt": "2025-03-01T17:41:29.173Z",
        "updatedAt": "2025-03-01T17:41:29.173Z",
        "__v": 0
    },
    "message": "User registered successfully"
}
```

### Login API

#### Endpoint: POST {{base_URL}}/apiv1/auth/login

#### Request Body: 
```json
{
    "email":"example@gmail.com",
    "password":"exe@1234"
}
```

#### Response:
```json
{
    "success": true,
    "token": "Example token",
    "user": {
        "_id": "id",
        "name": "Jane",
        "email": "Jane@gmail.com",
        "accountType": "Student",
        "createdAt": "2025-01-25T13:13:55.459Z",
        "updatedAt": "2025-01-25T13:13:55.459Z",
        "__v": 0
    },
    "message": "User Login Success"
}
```

## Exam APIs

### Create Exam

#### Endpoint: POST {{server_URL}}/apiv1/exam

#### Request Body:
```json
{
    "name": "cet"
}
```

#### Response:
```json
{
    "success": true,
    "message": "Exam created successfully",
    "body": {
        "name": "cet",
        "colleges": [],
        "_id": "67c4337e53a5f458262a135d",
        "createdAt": "2025-03-02T10:31:26.508Z",
        "updatedAt": "2025-03-02T10:31:26.508Z",
        "__v": 0
    }
}
```

## college APIs

### Create college

#### Endpoint: POST {{server_URL}}/apiv1/college

#### Request Body:
```json
{
   "name": "name",
   "location": "location",
   "year": "year",
   "affiliation": "affiliation",
   "type": "type",
   "admissionProcess": "admissionProcess",
   "infrastructure": "infrastructure",
   "review": "review",
   "courses": "courses",
   "examId": "67962a2cbfeb181485a474cb"
}
```

#### Response:
```json
{
    "success": true,
    "message": "college created",
    "college": {
        "name": "name",
        "location": "location",
        "year": "year",
        "affiliation": "affiliation",
        "type": "type",
        "courses": [
            "courses"
        ],
        "branches": [
            "67c4342c53a5f458262a1360"
        ],
        "admissionProcess": "admissionProcess",
        "infrastructure": "infrastructure",
        "placement": {
            "average": null,
            "highest": null,
            "_id": "67c4342c53a5f458262a1362",
            "createdAt": "2025-03-02T10:34:20.993Z",
            "updatedAt": "2025-03-02T10:34:20.993Z",
            "__v": 0
        },
        "review": "review",
        "_id": "67c4342d53a5f458262a1364",
        "createdAt": "2025-03-02T10:34:21.219Z",
        "updatedAt": "2025-03-02T10:34:21.219Z",
        "__v": 0
    },
    "exam": {
        "_id": "67962a2cbfeb181485a474cb",
        "name": "cet",
        "colleges": [
            "67962b32d24881b56ebb2fe2",
            "67c4342d53a5f458262a1364"
        ],
        "createdAt": "2025-01-26T12:27:24.396Z",
        "updatedAt": "2025-03-02T10:34:21.665Z",
        "__v": 2
    }
}
```

### Create branch
#### API: {{base_URL}}/apiv1/college/:collegeId/branch

#### Request: 
```json
{
    "name":"entc",
    "fees" : 23444
}
```

#### Response: 
```json
{
    "success": true,
    "message": "Branch created successfully",
    "body": {
        "name": "entc",
        "criteria": [],
        "fees": "23444",
        "_id": "67d4288b66d2359a5adb038b",
        "createdAt": "2025-03-14T13:00:59.842Z",
        "updatedAt": "2025-03-14T13:00:59.842Z",
        "__v": 0
    },
    "college": {
        "acknowledged": true,
        "modifiedCount": 1,
        "upsertedId": null,
        "upsertedCount": 0,
        "matchedCount": 1
    }
}
```

### Create Placement
#### API 
{{base_URL}}/apiv1/college/:collegeId/placement

#### Request
```json
{
    "average":234455,
    "highest":34349837
}
```

#### Response
```json
{
    "success": true,
    "message": "Placement created successfully",
    "body": {
        "average": "234455",
        "highest": "34349837",
        "_id": "67d4295a66d2359a5adb038e",
        "createdAt": "2025-03-14T13:04:26.777Z",
        "updatedAt": "2025-03-14T13:04:26.777Z",
        "__v": 0
    },
    "college": {
        "_id": "67d1b2050d2f6e26dc21e120",
        "name": "name",
        "location": "location",
        "year": "year",
        "affiliation": "affiliation",
        "type": "type",
        "courses": [
            "courses"
        ],
        "branches": [
            "67d1b20a0d2f6e26dc21e124",
            "67d1b235a1bae146d460bc70",
            "67d4288b66d2359a5adb038b"
        ],
        "admissionProcess": "admissionProcess",
        "infrastructure": "infrastructure",
        "review": "review",
        "createdAt": "2025-03-12T16:10:45.249Z",
        "updatedAt": "2025-03-14T13:00:59.960Z",
        "__v": 0,
        "placement": {
            "average": "234455",
            "highest": "34349837",
            "_id": "67d4295a66d2359a5adb038e",
            "createdAt": "2025-03-14T13:04:26.777Z",
            "updatedAt": "2025-03-14T13:04:26.777Z",
            "__v": 0
        }
    }
}
```

### Get college
#### API : 
{{base_URL}}/apiv1/college/:collegeId/

#### Response
```json
{
    "success": true,
    "college": {
        "_id": "67d1b2050d2f6e26dc21e120",
        "name": "name",
        "location": "location",
        "year": "year",
        "affiliation": "affiliation",
        "type": "type",
        "courses": [
            "courses"
        ],
        "branches": [
            {
                "_id": "67d1b20a0d2f6e26dc21e124",
                "name": "comp",
                "criteria": [],
                "fees": "23444",
                "createdAt": "2025-03-12T16:10:50.769Z",
                "updatedAt": "2025-03-12T16:10:50.769Z",
                "__v": 0
            },
            {
                "_id": "67d1b235a1bae146d460bc70",
                "name": "entc",
                "criteria": [],
                "fees": "23444",
                "createdAt": "2025-03-12T16:11:33.271Z",
                "updatedAt": "2025-03-12T16:11:33.271Z",
                "__v": 0
            },
            {
                "_id": "67d4288b66d2359a5adb038b",
                "name": "entc",
                "criteria": [],
                "fees": "23444",
                "createdAt": "2025-03-14T13:00:59.842Z",
                "updatedAt": "2025-03-14T13:00:59.842Z",
                "__v": 0
            }
        ],
        "admissionProcess": "admissionProcess",
        "infrastructure": "infrastructure",
        "review": "review",
        "createdAt": "2025-03-12T16:10:45.249Z",
        "updatedAt": "2025-03-14T13:04:27.033Z",
        "__v": 0,
        "placement": {
            "_id": "67d4295a66d2359a5adb038e",
            "average": "234455",
            "highest": "34349837",
            "createdAt": "2025-03-14T13:04:26.777Z",
            "updatedAt": "2025-03-14T13:04:26.777Z",
            "__v": 0
        }
    }
}
```
## Image API
### Upload image

#### API 
{{base_URL}}/apiv1/image

#### Request  (Multipart Form-Data):
FileFormat with "file" as name

#### Response
```json
{
    "success": true,
    "message": "Image Uploaded",
    "createdImage": {
        "image": "link",
        "_id": "67d42fc73aad6bfad4c9f336",
        "createdAt": "2025-03-14T13:31:51.207Z",
        "updatedAt": "2025-03-14T13:31:51.207Z",
        "__v": 0
    }
}
```
### Get all images
#### API 
{{base_URL}}/apiv1/image

#### Response 
```json
{
    "success": true,
    "images": [
        {
            "_id": "67d42fc73aad6bfad4c9f336",
            "image": "link",
            "createdAt": "2025-03-14T13:31:51.207Z",
            "updatedAt": "2025-03-14T13:31:51.207Z",
            "__v": 0
        }
    ]
}
```

### Get image by id
#### API 
{{base_URL}}/apiv1/image/:imageId

#### Response 
```json
{
    "success": true,
    "image": {
        "_id": "67d42fc73aad6bfad4c9f336",
        "image": "link",
        "createdAt": "2025-03-14T13:31:51.207Z",
        "updatedAt": "2025-03-14T13:31:51.207Z",
        "__v": 0
    }
}
```


Steps to run:-
1. Clone repo
2. cd backend
3. npm i
4. npm run server
