import { useState, useRef, useEffect } from 'react'
import ImageCarousel from './ImageCarousel'
import './MediaUploader.css'

function MediaUploader({ existingMedia = [], selectedFiles = [], onFilesChange, maxFiles = 6 }) {
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef(null)
  const [objectUrls, setObjectUrls] = useState([])

  // Create object URLs for preview
  useEffect(() => {
    const urls = selectedFiles.map(file => URL.createObjectURL(file))
    setObjectUrls(urls)
    
    // Cleanup function
    return () => {
      urls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [selectedFiles])

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files)
      const remainingSlots = maxFiles - existingMedia.length - selectedFiles.length
      const filesToAdd = files.slice(0, remainingSlots)
      
      if (filesToAdd.length > 0) {
        onFilesChange([...selectedFiles, ...filesToAdd])
      }
    }
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const files = Array.from(e.target.files)
      const remainingSlots = maxFiles - existingMedia.length - selectedFiles.length
      const filesToAdd = files.slice(0, remainingSlots)
      
      if (filesToAdd.length > 0) {
        onFilesChange([...selectedFiles, ...filesToAdd])
      }
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeFile = (index) => {
    // Revoke the object URL for the removed file
    if (objectUrls[index]) {
      URL.revokeObjectURL(objectUrls[index])
    }
    const newFiles = selectedFiles.filter((_, i) => i !== index)
    onFilesChange(newFiles)
  }

  const removeExistingMedia = (index) => {
    // For edit mode, we might want to mark existing media for deletion
    // For now, just show a message that removal should be handled server-side
    // Or we could filter it out from the display (but it would still be sent)
    console.warn('Existing media removal should be handled via API endpoint')
  }

  const allMedia = [
    ...existingMedia.map(media => ({
      file: media.file,
      media_type: media.media_type,
      isExisting: true,
      id: media.id || media.file
    })),
    ...selectedFiles.map((file, index) => ({
      file: objectUrls[index] || '',
      media_type: file.type.startsWith('video/') ? 'video' : 'image',
      isNew: true,
      fileObject: file,
      id: `new-${index}`
    }))
  ]

  const totalMediaCount = existingMedia.length + selectedFiles.length
  const canAddMore = totalMediaCount < maxFiles

  return (
    <div className="media-uploader">
      {allMedia.length > 0 && (
        <div className="media-preview-section">
          <div className="media-preview-header">
            <h3>Media Preview ({totalMediaCount}/{maxFiles})</h3>
            {allMedia.length > 1 && (
              <div className="media-carousel-wrapper">
                <ImageCarousel 
                  media={allMedia} 
                  title="Campaign Media"
                />
              </div>
            )}
            {allMedia.length === 1 && (
              <div className="media-single-preview">
                {allMedia[0].media_type === 'image' ? (
                  <img 
                    src={allMedia[0].file} 
                    alt="Media preview" 
                  />
                ) : (
                  <video 
                    src={allMedia[0].file} 
                    controls 
                  />
                )}
              </div>
            )}
          </div>

          {selectedFiles.length > 0 && (
            <div className="selected-files-list">
              <h4>New Files to Upload:</h4>
              <div className="files-grid">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="file-preview-item">
                    {file.type.startsWith('image/') ? (
                      <img 
                        src={objectUrls[index] || ''} 
                        alt={`Preview ${index + 1}`}
                      />
                    ) : (
                      <video 
                        src={objectUrls[index] || ''} 
                        controls
                      />
                    )}
                    <button
                      type="button"
                      className="remove-file-btn"
                      onClick={() => removeFile(index)}
                      aria-label="Remove file"
                    >
                      ×
                    </button>
                    <div className="file-name">{file.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {existingMedia.length > 0 && (
            <div className="existing-files-list">
              <h4>Existing Media ({existingMedia.length}):</h4>
              <div className="files-grid">
                {existingMedia.map((media, index) => (
                  <div key={index} className="file-preview-item existing">
                    {media.media_type === 'image' ? (
                      <img 
                        src={media.file} 
                        alt={`Existing media ${index + 1}`}
                      />
                    ) : (
                      <video 
                        src={media.file} 
                        controls
                      />
                    )}
                    <div className="file-badge">Existing</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {canAddMore && (
        <div
          className={`file-upload-area ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            id="media_files"
            name="media_files"
            onChange={handleFileChange}
            multiple
            accept="image/*,video/*"
            className="file-input"
          />
          <label htmlFor="media_files" className="file-upload-label">
            <div className="upload-icon">📷</div>
            <div className="upload-text">
              <strong>Click to upload</strong> or drag and drop
            </div>
            <div className="upload-hint">
              Images or videos (up to {maxFiles - totalMediaCount} more)
            </div>
          </label>
        </div>
      )}

      {!canAddMore && (
        <div className="upload-limit-reached">
          Maximum of {maxFiles} media files reached
        </div>
      )}
    </div>
  )
}

export default MediaUploader

