/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // add field
  collection.fields.addAt(12, new Field({
    "hidden": false,
    "id": "file3656096993",
    "maxSelect": 1,
    "maxSize": 5,
    "mimeTypes": [
      "image/jpeg",
      "image/png"
    ],
    "name": "selfie",
    "presentable": false,
    "protected": false,
    "required": true,
    "system": false,
    "thumbs": [],
    "type": "file"
  }))

  // add field
  collection.fields.addAt(13, new Field({
    "hidden": false,
    "id": "file4197631272",
    "maxSelect": 1,
    "maxSize": 1,
    "mimeTypes": [
      "image/png",
      "image/jpeg"
    ],
    "name": "id_photo",
    "presentable": false,
    "protected": false,
    "required": true,
    "system": false,
    "thumbs": [],
    "type": "file"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // remove field
  collection.fields.removeById("file3656096993")

  // remove field
  collection.fields.removeById("file4197631272")

  return app.save(collection)
})
