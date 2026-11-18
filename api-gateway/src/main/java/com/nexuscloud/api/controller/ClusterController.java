package com.nexuscloud.api.controller;

import com.nexuscloud.api.service.NexusService;
import com.nexuscloud.common.model.NodeHealthInfo;

import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/cluster")
public class ClusterController {

    private final NexusService service;

    public ClusterController(NexusService service) {
        this.service = service;
    }

    @GetMapping("/health")
    public Map<String, Object> health()
            throws Exception {

        return Map.of(
                "status", "UP",
                "master", service.master().ping(),
                "timestamp", Instant.now().toString()
        );
    }

    @GetMapping("/nodes")
    public List<NodeHealthInfo> nodes()
            throws Exception {

        return service.nodes();
    }

    @GetMapping("/stats")
    public Map<String, Object> statistics()
            throws Exception {

        return service.clusterStats();
    }
}