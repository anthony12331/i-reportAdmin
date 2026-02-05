/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1220150045")

  // update field
  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "file2651432501",
    "maxSelect": 1,
    "maxSize": 5242880,
    "mimeTypes": [
      "image/png",
      "image/jpeg"
    ],
    "name": "incident_image",
    "presentable": false,
    "protected": false,
    "required": true,
    "system": false,
    "thumbs": [],
    "type": "file"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1220150045")

  // update field
  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "file2651432501",
    "maxSelect": 1,
    "maxSize": 5,
    "mimeTypes": [
      "image/png",
      "image/jpeg"
    ],
    "name": "incident_image",
    "presentable": false,
    "protected": false,
    "required": true,
    "system": false,
    "thumbs": [],
    "type": "file"
  }))

  return app.save(collection)
})
